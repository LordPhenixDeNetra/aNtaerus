use crate::contracts::{ServiceCapabilities, ServiceHealth, SystemStatus};

pub struct SystemEvent {
    pub topic: String,
    pub payload: Vec<(String, String)>,
}

pub trait HealthReader {
    fn read_health(&self) -> ServiceHealth;
}

pub trait CapabilityReader {
    fn read_capabilities(&self) -> ServiceCapabilities;
}

pub trait SystemAggregator {
    fn build_system_status(&self) -> SystemStatus;
}

pub trait EventNotifier {
    fn publish(&self, event: SystemEvent);
}
