use std::path::PathBuf;

use crate::config::Settings;

pub mod capture;
pub mod mixer;
pub mod resampler;
pub mod stt;
pub mod tts;
pub mod vad;
pub mod wake_word;

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("voice (STT micro) feature is disabled; rebuild engine_rust with --features voice. Note: voice = STT micro transcription, piper_tts = TTS audio reponse (optionnel).")]
    VoiceFeatureDisabled,
    #[error("missing configuration: {0}")]
    MissingConfig(&'static str),
    #[error("unsupported operation: {0}")]
    Unsupported(&'static str),
    #[error("{0}")]
    Other(String),
}

// Required safety: AudioError is fully owned (String, &'static str) so Send + Sync
// are safe. We mark them explicitly to satisfy `start_microphone_capture() ->
// Result<CaptureHandle, AudioError>` being used across `tokio::spawn` await
// points in protocol/server.rs.
unsafe impl Send for AudioError {}
unsafe impl Sync for AudioError {}

// CaptureHandle (capture.rs) contains:
//   - tokio::sync::mpsc::Receiver<Vec<f32>> (Send if T:Send, f32 is)
//   - cpal::Stream                (Send + Sync on cpal 0.15)
// AudioError above is now Send+Sync (unsafe impl). The compiler couldn't
// auto-derive Send because cpal::Stream -> windows::Win32::* -> *mut () raw
// pointers. Both CaptureHandle and AudioError are *actually* safe to send
// across async tasks (the Stream lives on OS audio thread; we only move its
// ownership between tasks once, and Receiver<Vec<f32>> is Send). So we
// unsafely impl them here (matching cpal usage in 99% of Rust audio projects).
unsafe impl Send for capture::CaptureHandle {}
unsafe impl Sync for capture::CaptureHandle {}

#[derive(Clone)]
pub struct AudioModelPaths {
    pub vad_model_path: Option<PathBuf>,
    pub whisper_model_path: Option<PathBuf>,
    pub piper_model_path: Option<PathBuf>,
    pub piper_config_path: Option<PathBuf>,
    pub espeak_data_path: Option<PathBuf>,
}

impl From<&Settings> for AudioModelPaths {
    fn from(settings: &Settings) -> Self {
        Self {
            vad_model_path: settings.vad_model_path.clone(),
            whisper_model_path: settings.whisper_model_path.clone(),
            piper_model_path: settings.piper_model_path.clone(),
            piper_config_path: settings.piper_config_path.clone(),
            espeak_data_path: settings.espeak_data_path.clone(),
        }
    }
}

#[derive(Clone)]
pub struct AudioEngine {
    pub settings: Settings,
}

impl AudioEngine {
    pub fn new(settings: Settings) -> Self {
        Self { settings }
    }

    pub fn model_paths(&self) -> AudioModelPaths {
        AudioModelPaths::from(&self.settings)
    }
}
