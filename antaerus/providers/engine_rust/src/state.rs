use chrono::{DateTime, Utc};
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceHealth {
    pub name: String,
    pub status: String,
    pub version: String,
    pub port: u16,
    pub url: String,
    pub checked_at: DateTime<Utc>,
    pub details: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct ServiceCapabilities {
    pub name: String,
    pub version: String,
    pub runtime: String,
    pub capabilities: Vec<String>,
}

pub fn build_health(name: &str, version: &str, port: u16) -> ServiceHealth {
    ServiceHealth {
        name: name.to_string(),
        status: "healthy".to_string(),
        version: version.to_string(),
        port,
        url: format!("http://localhost:{port}"),
        checked_at: Utc::now(),
        details: "Engine foundation service operational".to_string(),
    }
}

pub fn build_capabilities(name: &str, version: &str) -> ServiceCapabilities {
    #[cfg_attr(not(feature = "wasm-runtime"), allow(unused_mut))]
    let mut capabilities = vec![
        "healthcheck".to_string(),
        "capability-reporting".to_string(),
        "audio-capture".to_string(),
        "audio-vad".to_string(),
        "audio-stt".to_string(),
        "audio-tts".to_string(),
        "audio-mixer".to_string(),
        "audio-resampler".to_string(),
        "grpc-audio-runtime".to_string(),
        "fs-sandbox".to_string(),
        "fs-readonly-reader".to_string(),
        "cli-sandbox".to_string(),
    ];
    #[cfg(feature = "wasm-runtime")]
    capabilities.push("wasm-runtime".to_string());

    ServiceCapabilities {
        name: name.to_string(),
        version: version.to_string(),
        runtime: "rust".to_string(),
        capabilities,
    }
}
