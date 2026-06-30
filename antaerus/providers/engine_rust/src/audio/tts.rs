use std::path::Path;

use super::AudioError;

#[cfg(feature = "voice")]
use piper1_rs::Piper;

#[cfg_attr(not(feature = "voice"), allow(dead_code))]
pub struct TextToSpeech {
    model_path: String,
    config_path: Option<String>,
    espeak_data_path: String,
}

impl TextToSpeech {
    pub fn new(model_path: &Path, config_path: Option<&Path>, espeak_data_path: &Path) -> Result<Self, AudioError> {
        let model_path = model_path
            .to_str()
            .ok_or(AudioError::MissingConfig("ANTAERUS_ENGINE_PIPER_MODEL_PATH"))?
            .to_string();
        let config_path = config_path.and_then(|path| path.to_str().map(|value| value.to_string()));
        let espeak_data_path = espeak_data_path
            .to_str()
            .ok_or(AudioError::MissingConfig("ANTAERUS_ENGINE_ESPEAK_DATA_PATH"))?
            .to_string();

        Ok(Self {
            model_path,
            config_path,
            espeak_data_path,
        })
    }

    pub fn synthesize(&self, text: &str) -> Result<(u32, Vec<f32>), AudioError> {
        #[cfg(feature = "voice")]
        {
            let mut piper = Piper::new(
                self.model_path.clone(),
                self.config_path.clone(),
                self.espeak_data_path.clone(),
            )
            .map_err(|err| AudioError::Other(err.to_string()))?;

            let options = piper.get_default_synthesis_options();
            let mut handle = piper
                .start_synthesis(text.to_string(), &[options])
                .map_err(|err| AudioError::Other(err.to_string()))?;

            let mut sample_rate = 0_u32;
            let mut out = Vec::new();

            while let Some(chunk) = handle
                .get_next_chunk()
                .map_err(|err| AudioError::Other(err.to_string()))?
            {
                if sample_rate == 0 {
                    sample_rate = chunk.sample_rate();
                }
                out.extend_from_slice(chunk.samples());
                if chunk.is_last() {
                    break;
                }
            }

            if sample_rate == 0 {
                return Err(AudioError::Other("TTS produced no audio".to_string()));
            }

            return Ok((sample_rate, out));
        }

        #[cfg(not(feature = "voice"))]
        {
            let _ = text;
            Err(AudioError::VoiceFeatureDisabled)
        }
    }
}
