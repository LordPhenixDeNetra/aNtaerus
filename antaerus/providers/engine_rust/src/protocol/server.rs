use std::collections::HashMap;

use tokio::sync::{mpsc, oneshot, Mutex};
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};

use crate::{
    audio::{
        capture::start_microphone_capture,
        mixer::{Mixer, NullSink},
        resampler::resample_linear_mono,
        stt::SpeechToText,
        tts::TextToSpeech,
        vad::VadDetector,
        wake_word::{WakeWordDecision, WakeWordGate},
        AudioEngine, AudioError,
    },
    config::Settings,
    grpc::audiopb::{
        audio_runtime_server::AudioRuntime, voice_event, SpeakRequest, SpeakResponse,
        StartVoiceSessionRequest, StopVoiceSessionRequest, StopVoiceSessionResponse, SystemEvent,
        TranscriptEvent, VadEvent, VoiceEvent, WakeWordEvent,
    },
};

pub type VoiceEventStream = ReceiverStream<Result<VoiceEvent, Status>>;

#[derive(Clone)]
pub struct AudioRuntimeService {
    engine: AudioEngine,
    sessions: std::sync::Arc<Mutex<HashMap<String, oneshot::Sender<()>>>>,
    mixer: Mixer,
}

impl AudioRuntimeService {
    pub fn new(settings: Settings) -> Self {
        let engine = AudioEngine::new(settings);
        let sessions = std::sync::Arc::new(Mutex::new(HashMap::new()));
        let mixer = Mixer::new(std::sync::Arc::new(NullSink));
        Self {
            engine,
            sessions,
            mixer,
        }
    }

    async fn stop_session(&self, session_id: &str) -> bool {
        let mut sessions = self.sessions.lock().await;
        if let Some(sender) = sessions.remove(session_id) {
            let _ = sender.send(());
            return true;
        }
        false
    }

    async fn start_session_task(
        &self,
        session_id: String,
        _language: String,
        mut stop: oneshot::Receiver<()>,
        sender: mpsc::Sender<Result<VoiceEvent, Status>>,
    ) {
        let _ = sender
            .send(Ok(system_event(
                session_id.clone(),
                "info",
                "voice session started".to_string(),
            )))
            .await;
        let mut wake_word_gate = WakeWordGate::new(self.engine.settings.wake_word.as_str());
        let _ = sender
            .send(Ok(wake_word_event(
                session_id.clone(),
                wake_word_gate.state().as_str(),
            )))
            .await;

        if !cfg!(any(feature = "voice", feature = "voice_stt")) {
            // === DEBUG INSTRUMENTATION voice-feature-disabled-bug: message tres verbeux pour UI ===
            let diag = format!(
                "[DIAG voice-feature-disabled-bug v2 / server.rs:L{}] cfg(voice|voice_stt)=FALSE. 
Build cargo n'a AUCUNE feature STT active. Features compile-time:
  feature voice ......... {}
  feature voice_stt ..... {}
  feature piper_tts ..... {}
  feature wasm-runtime .. {}
RAPPEL Cargo.toml reorganise: features voice = STT micro; voice_stt = alias STT; piper_tts = TTS optionnel.
SOLUTION 1 SEUL COMMANDE POUR DEBUG:
  cd N:\\...\\antaerus\\scripts; .\\stop-all.ps1
  Remove-Item -Recurse -Force C:\\b\\er
  Set-Location ..\\providers\\engine_rust
  cargo run --features voice",
                line!(),
                cfg!(any(feature = "voice", feature = "voice_stt")),
                cfg!(feature = "voice_stt"),
                cfg!(feature = "piper_tts"),
                cfg!(feature = "wasm-runtime"),
            );
            let _ = sender
                .send(Ok(system_event(
                    session_id,
                    "error",
                    diag,
                )))
                .await;
            return;
        }

        if self.engine.settings.whisper_model_path.is_none() {
            let _ = sender
                .send(Ok(system_event(
                    session_id,
                    "error",
                    "missing ANTAERUS_ENGINE_WHISPER_MODEL_PATH".to_string(),
                )))
                .await;
            return;
        }

        let whisper_model_path = self.engine.settings.whisper_model_path.clone().unwrap();
        let vad_model_path = self.engine.settings.vad_model_path.clone();
        let input_rate = self
            .engine
            .settings
            .audio_input_sample_rate
            .unwrap_or(16_000);

        let capture = match start_microphone_capture() {
            Ok(capture) => capture,
            Err(err) => {
                let message = format!("capture error: {err}");
                let _ = sender
                    .send(Ok(system_event(
                        session_id,
                        "error",
                        message,
                    )))
                    .await;
                return;
            }
        };

        let mut receiver = capture.receiver();
        let stt = match SpeechToText::from_model_path(whisper_model_path.as_path()) {
            Ok(stt) => stt,
            Err(err) => {
                let message = format!("stt init error: {err}");
                let _ = sender
                    .send(Ok(system_event(
                        session_id,
                        "error",
                        message,
                    )))
                    .await;
                return;
            }
        };

        let mut vad = match VadDetector::new(vad_model_path.as_deref(), 0.01) {
            Ok(vad) => vad,
            Err(err) => {
                let message = format!("vad init error: {err}");
                let _ = sender
                    .send(Ok(system_event(
                        session_id,
                        "error",
                        message,
                    )))
                    .await;
                return;
            }
        };

        let mut speaking = false;
        let mut buffer = Vec::<f32>::new();

        loop {
            tokio::select! {
                _ = &mut stop => {
                    let _ = sender.send(Ok(system_event(session_id.clone(), "info", "voice session stopped".to_string()))).await;
                    break;
                }
                chunk = receiver.recv() => {
                    let Some(chunk) = chunk else {
                        let _ = sender.send(Ok(system_event(session_id.clone(), "error", "capture ended".to_string()))).await;
                        break;
                    };

                    let chunk_16k = resample_linear_mono(&chunk, input_rate, 16_000);
                    let next_speaking = match vad.push_samples(&chunk_16k) {
                        Ok(state) => state,
                        Err(err) => {
                            let message = format!("vad error: {err}");
                            let _ = sender.send(Ok(system_event(session_id.clone(), "error", message))).await;
                            break;
                        }
                    };

                    if next_speaking != speaking {
                        speaking = next_speaking;
                        let _ = sender.send(Ok(vad_event(session_id.clone(), speaking))).await;

                        if !speaking && !buffer.is_empty() {
                            let text = stt.transcribe_16khz_mono(&buffer).unwrap_or_else(|_| String::new());
                            let trimmed = text.trim();
                            if !trimmed.is_empty() {
                                let previous_wake_state = wake_word_gate.state();
                                match wake_word_gate.evaluate(trimmed) {
                                    WakeWordDecision::Ignored => {}
                                    WakeWordDecision::ArmedNoCommand => {
                                        if wake_word_gate.state() != previous_wake_state {
                                            let _ = sender
                                                .send(Ok(wake_word_event(
                                                    session_id.clone(),
                                                    wake_word_gate.state().as_str(),
                                                )))
                                                .await;
                                        }
                                    }
                                    WakeWordDecision::ArmedWithCommand(cleaned_text) => {
                                        if wake_word_gate.state() != previous_wake_state {
                                            let _ = sender
                                                .send(Ok(wake_word_event(
                                                    session_id.clone(),
                                                    wake_word_gate.state().as_str(),
                                                )))
                                                .await;
                                        }
                                        let _ = sender
                                            .send(Ok(transcript_event(
                                                session_id.clone(),
                                                cleaned_text,
                                                true,
                                            )))
                                            .await;
                                    }
                                    WakeWordDecision::PassThrough(cleaned_text) => {
                                        let _ = sender
                                            .send(Ok(transcript_event(
                                                session_id.clone(),
                                                cleaned_text,
                                                true,
                                            )))
                                            .await;
                                    }
                                }
                            }
                            buffer.clear();
                        }
                    }

                    if speaking {
                        buffer.extend_from_slice(&chunk_16k);
                    }
                }
            }
        }
    }

    fn tts_from_settings(&self) -> Result<TextToSpeech, AudioError> {
        let model_path = self
            .engine
            .settings
            .piper_model_path
            .as_deref()
            .ok_or(AudioError::MissingConfig("ANTAERUS_ENGINE_PIPER_MODEL_PATH"))?;
        let config_path = self.engine.settings.piper_config_path.as_deref();
        let espeak_data_path = self
            .engine
            .settings
            .espeak_data_path
            .as_deref()
            .ok_or(AudioError::MissingConfig("ANTAERUS_ENGINE_ESPEAK_DATA_PATH"))?;

        TextToSpeech::new(model_path, config_path, espeak_data_path)
    }
}

#[tonic::async_trait]
impl AudioRuntime for AudioRuntimeService {
    type StartVoiceSessionStream = VoiceEventStream;

    async fn start_voice_session(
        &self,
        request: Request<StartVoiceSessionRequest>,
    ) -> Result<Response<Self::StartVoiceSessionStream>, Status> {
        let request = request.into_inner();
        if request.session_id.trim().is_empty() {
            return Err(Status::invalid_argument("session_id must not be empty"));
        }

        let (stop_sender, stop_receiver) = oneshot::channel::<()>();
        {
            let mut sessions = self.sessions.lock().await;
            // --- (B) SESSION EXIST DEJA: UPSERT (never AlreadyExists error) ---
            // Si une ancienne session orpheline est encore dans sessions (ex: stream frontend ferme anormalement sans StopVoiceSession),
            // on STOP proprement l'ancienne PUIS on remplace par la nouvelle.
            if sessions.contains_key(&request.session_id) {
                // Envoyer signal stop à l'ancienne task de session (elle se cleanup elle-meme via drop/receiver)
                if let Some(old_stopper) = sessions.remove(&request.session_id) {
                    let _ = old_stopper.send(());
                }
                // Mini sleep 50ms tokio pour laisser ancienne task retirer son stop sender de sessions si concurrence
                drop(sessions);
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                // Reprendre lock
                let mut sessions2 = self.sessions.lock().await;
                // Double-check: si entre temps quelqu'un re-insert (ne devrait pas arriver)
                if sessions2.contains_key(&request.session_id) {
                    if let Some(old2) = sessions2.remove(&request.session_id) {
                        let _ = old2.send(());
                    }
                }
                sessions2.insert(request.session_id.clone(), stop_sender);
            } else {
                sessions.insert(request.session_id.clone(), stop_sender);
            }
        }

        let (sender, receiver) = mpsc::channel::<Result<VoiceEvent, Status>>(32);
        let service = self.clone();
        tokio::spawn(async move {
            service
                .start_session_task(
                    request.session_id,
                    request.language,
                    stop_receiver,
                    sender,
                )
                .await;
        });

        Ok(Response::new(ReceiverStream::new(receiver)))
    }

    async fn stop_voice_session(
        &self,
        request: Request<StopVoiceSessionRequest>,
    ) -> Result<Response<StopVoiceSessionResponse>, Status> {
        let request = request.into_inner();
        let stopped = self.stop_session(request.session_id.as_str()).await;
        Ok(Response::new(StopVoiceSessionResponse {
            session_id: request.session_id,
            stopped,
        }))
    }

    async fn speak(
        &self,
        request: Request<SpeakRequest>,
    ) -> Result<Response<SpeakResponse>, Status> {
        if !cfg!(feature = "piper_tts") {
            return Err(Status::failed_precondition(
                "piper_tts feature is disabled; rebuild engine_rust with --features \"voice,piper_tts\" to enable TTS audio (actuellement STT micro transcription seulement)",
            ));
        }

        let request = request.into_inner();
        if request.session_id.trim().is_empty() {
            return Err(Status::invalid_argument("session_id must not be empty"));
        }
        if request.text.trim().is_empty() {
            return Err(Status::invalid_argument("text must not be empty"));
        }

        let tts = self
            .tts_from_settings()
            .map_err(|err| Status::failed_precondition(err.to_string()))?;
        let (sample_rate, samples) = tts
            .synthesize(request.text.as_str())
            .map_err(|err| Status::internal(err.to_string()))?;

        self.mixer
            .play(sample_rate, samples)
            .await
            .map_err(|err| Status::internal(err.to_string()))?;

        Ok(Response::new(SpeakResponse {
            session_id: request.session_id,
            accepted: true,
        }))
    }
}

fn system_event(session_id: String, level: &str, message: String) -> VoiceEvent {
    VoiceEvent {
        session_id,
        payload: Some(voice_event::Payload::System(SystemEvent {
            level: level.to_string(),
            message,
        })),
    }
}

#[allow(dead_code)]
fn vad_event(session_id: String, speaking: bool) -> VoiceEvent {
    VoiceEvent {
        session_id,
        payload: Some(voice_event::Payload::Vad(VadEvent { speaking })),
    }
}

#[allow(dead_code)]
fn transcript_event(session_id: String, text: String, is_final: bool) -> VoiceEvent {
    VoiceEvent {
        session_id,
        payload: Some(voice_event::Payload::Transcript(TranscriptEvent { text, is_final })),
    }
}

fn wake_word_event(session_id: String, state: &str) -> VoiceEvent {
    VoiceEvent {
        session_id,
        payload: Some(voice_event::Payload::WakeWord(WakeWordEvent {
            state: state.to_string(),
        })),
    }
}
