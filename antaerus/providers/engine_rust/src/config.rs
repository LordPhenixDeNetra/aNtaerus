use std::env;

use secrecy::SecretString;

#[derive(Clone, Debug)]
pub struct Settings {
    pub service_name: String,
    pub version: String,
    pub port: u16,
    pub grpc_port: u16,
    pub api_secret: SecretString,
}

impl Settings {
    pub fn from_env() -> Self {
        let version = env::var("ANTAERUS_ENGINE_VERSION").unwrap_or_else(|_| "0.1.0".to_string());
        let port = env::var("ANTAERUS_ENGINE_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(7000);
        let grpc_port = env::var("ANTAERUS_ENGINE_GRPC_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(7001);

        Self {
            service_name: "engine_rust".to_string(),
            version,
            port,
            grpc_port,
            api_secret: SecretString::new(
                env::var("ANTAERUS_ENGINE_API_SECRET")
                    .unwrap_or_else(|_| "development-secret".to_string()),
            ),
        }
    }
}
