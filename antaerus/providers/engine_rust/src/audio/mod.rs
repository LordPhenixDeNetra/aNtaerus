use std::path::PathBuf;

use crate::config::Settings;

pub mod capture;
pub mod mixer;
pub mod resampler;
pub mod stt;
pub mod tts;
pub mod vad;

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("voice feature is disabled; rebuild with --features voice")]
    VoiceFeatureDisabled,
    #[error("missing configuration: {0}")]
    MissingConfig(&'static str),
    #[error("unsupported operation: {0}")]
    Unsupported(&'static str),
    #[error("{0}")]
    Other(String),
}

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
