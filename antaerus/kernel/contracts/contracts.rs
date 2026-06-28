#[derive(Clone, Debug)]
pub struct ServiceHealth {
    pub name: String,
    pub status: String,
    pub version: String,
    pub port: u16,
    pub url: String,
    pub checked_at: String,
    pub details: String,
}

#[derive(Clone, Debug)]
pub struct ServiceCapabilities {
    pub name: String,
    pub version: String,
    pub runtime: String,
    pub capabilities: Vec<String>,
}

#[derive(Clone, Debug)]
pub struct SystemStatus {
    pub product: String,
    pub phase: String,
    pub environment: String,
    pub services: Vec<ServiceHealth>,
    pub capabilities: Vec<ServiceCapabilities>,
}
