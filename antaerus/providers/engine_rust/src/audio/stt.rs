use std::path::Path;

use super::AudioError;

#[cfg(any(feature = "voice", feature = "voice_stt"))]
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct SpeechToText {
    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    context: WhisperContext,
    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    language: Option<String>,
}

impl SpeechToText {
    pub fn from_model_path(model_path: &Path, language: Option<String>) -> Result<Self, AudioError> {
        #[cfg(any(feature = "voice", feature = "voice_stt"))]
        {
            let context = WhisperContext::new_with_params(
                model_path.to_string_lossy().as_ref(),
                WhisperContextParameters::default(),
            )
            .map_err(|err| AudioError::Other(err.to_string()))?;
            return Ok(Self { context, language });
        }

        #[cfg(not(any(feature = "voice", feature = "voice_stt")))]
        {
            let _ = (model_path, language);
            Err(AudioError::VoiceFeatureDisabled)
        }
    }

    pub fn transcribe_16khz_mono(&self, samples: &[f32]) -> Result<String, AudioError> {
        #[cfg(any(feature = "voice", feature = "voice_stt"))]
        {
            let mut state = self
                .context
                .create_state()
                .map_err(|err| AudioError::Other(err.to_string()))?;
            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            params.set_translate(false);
            params.set_print_special(false);
            params.set_print_progress(false);
            params.set_print_timestamps(false);
            let normalized_lang: Option<String> = self.language.as_deref().and_then(|lang| {
                if lang.is_empty() {
                    None
                } else if lang.len() == 2 {
                    Some(lang.to_ascii_lowercase())
                } else {
                    Some(lang.chars().take(2).collect::<String>().to_ascii_lowercase())
                }
            });
            if let Some(lang_code) = normalized_lang.as_deref() {
                params.set_language(Some(lang_code));
            }

            state
                .full(params, samples)
                .map_err(|err| AudioError::Other(err.to_string()))?;

            let mut text = String::new();
            for segment in state.as_iter() {
                if !text.is_empty() {
                    text.push(' ');
                }
                text.push_str(segment.to_string().trim());
            }

            return Ok(text.trim().to_string());
        }

        #[cfg(not(any(feature = "voice", feature = "voice_stt")))]
        {
            let _ = samples;
            Err(AudioError::VoiceFeatureDisabled)
        }
    }
}

