use std::path::Path;

use super::AudioError;

#[cfg(feature = "voice")]
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct SpeechToText {
    #[cfg(feature = "voice")]
    context: WhisperContext,
}

impl SpeechToText {
    pub fn from_model_path(model_path: &Path) -> Result<Self, AudioError> {
        #[cfg(feature = "voice")]
        {
            let context = WhisperContext::new_with_params(
                model_path.to_string_lossy().as_ref(),
                WhisperContextParameters::default(),
            )
            .map_err(|err| AudioError::Other(err.to_string()))?;
            return Ok(Self { context });
        }

        #[cfg(not(feature = "voice"))]
        {
            let _ = model_path;
            Err(AudioError::VoiceFeatureDisabled)
        }
    }

    pub fn transcribe_16khz_mono(&self, samples: &[f32]) -> Result<String, AudioError> {
        #[cfg(feature = "voice")]
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

        #[cfg(not(feature = "voice"))]
        {
            let _ = samples;
            Err(AudioError::VoiceFeatureDisabled)
        }
    }
}

