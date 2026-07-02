use std::{env, path::{Path, PathBuf}};

use secrecy::SecretString;

#[derive(Clone, Debug)]
pub struct Settings {
    pub service_name: String,
    pub version: String,
    pub port: u16,
    pub grpc_port: u16,
    pub api_secret: SecretString,
    pub audio_input_device: Option<String>,
    pub audio_output_device: Option<String>,
    pub audio_input_sample_rate: Option<u32>,
    pub audio_output_sample_rate: Option<u32>,
    pub vad_model_path: Option<PathBuf>,
    pub whisper_model_path: Option<PathBuf>,
    pub piper_model_path: Option<PathBuf>,
    pub piper_config_path: Option<PathBuf>,
    pub espeak_data_path: Option<PathBuf>,
    pub wake_word: String,
    pub tools_config_path: PathBuf,
    pub tools_sandbox_root: PathBuf,
}

impl Settings {
    pub fn from_env() -> Self {
        let workspace_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .canonicalize()
            .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."));
        let version = env::var("ANTAERUS_ENGINE_VERSION").unwrap_or_else(|_| "0.1.0".to_string());
        let port = env::var("ANTAERUS_ENGINE_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(7000);
        let grpc_port = env::var("ANTAERUS_ENGINE_GRPC_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(7001);

        let audio_input_sample_rate = env::var("ANTAERUS_ENGINE_AUDIO_INPUT_SAMPLE_RATE")
            .ok()
            .and_then(|value| value.parse::<u32>().ok());
        let audio_output_sample_rate = env::var("ANTAERUS_ENGINE_AUDIO_OUTPUT_SAMPLE_RATE")
            .ok()
            .and_then(|value| value.parse::<u32>().ok());
        let tools_config_path = resolve_project_path(
            env::var("ANTAERUS_ENGINE_TOOLS_CONFIG_PATH")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            &workspace_root,
            "config/tools.yaml",
        );
        let tools_sandbox_root = resolve_project_path(
            env::var("ANTAERUS_ENGINE_TOOLS_SANDBOX_ROOT")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            &workspace_root,
            ".",
        );

        Self {
            service_name: "engine_rust".to_string(),
            version,
            port,
            grpc_port,
            api_secret: SecretString::new(
                env::var("ANTAERUS_ENGINE_API_SECRET")
                    .unwrap_or_else(|_| "development-secret".to_string()),
            ),
            audio_input_device: env::var("ANTAERUS_ENGINE_AUDIO_INPUT_DEVICE").ok(),
            audio_output_device: env::var("ANTAERUS_ENGINE_AUDIO_OUTPUT_DEVICE").ok(),
            audio_input_sample_rate,
            audio_output_sample_rate,
            vad_model_path: env::var("ANTAERUS_ENGINE_VAD_MODEL_PATH").ok().map(PathBuf::from),
            whisper_model_path: env::var("ANTAERUS_ENGINE_WHISPER_MODEL_PATH")
                .ok()
                .map(PathBuf::from),
            piper_model_path: env::var("ANTAERUS_ENGINE_PIPER_MODEL_PATH").ok().map(PathBuf::from),
            piper_config_path: env::var("ANTAERUS_ENGINE_PIPER_CONFIG_PATH")
                .ok()
                .map(PathBuf::from),
            espeak_data_path: env::var("ANTAERUS_ENGINE_ESPEAK_DATA_PATH")
                .ok()
                .map(PathBuf::from),
            wake_word: env::var("ANTAERUS_ENGINE_WAKE_WORD")
                .ok()
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "aNtaerus".to_string()),
            tools_config_path,
            tools_sandbox_root,
        }
    }
}

fn resolve_project_path(
    raw_value: Option<String>,
    workspace_root: &Path,
    default_relative: &str,
) -> PathBuf {
    let candidate = raw_value
        .map(PathBuf::from)
        .unwrap_or_else(|| workspace_root.join(default_relative));
    if candidate.is_absolute() {
        candidate
    } else {
        workspace_root.join(candidate)
    }
}
