use std::{
    net::SocketAddr,
    time::{SystemTime, UNIX_EPOCH},
};

use tonic::{transport::Server, Request, Response, Status};

use crate::{
    config::Settings,
    grpc::enginepb::{
        engine_runtime_server::{EngineRuntime, EngineRuntimeServer},
        CapabilitiesRequest, CapabilitiesResponse, HealthRequest, HealthResponse, PingRequest,
        PingResponse,
    },
    state::{build_capabilities, build_health},
};

#[derive(Clone)]
struct EngineRuntimeService {
    settings: Settings,
}

impl EngineRuntimeService {
    fn new(settings: Settings) -> Self {
        Self { settings }
    }
}

#[tonic::async_trait]
impl EngineRuntime for EngineRuntimeService {
    async fn ping(&self, request: Request<PingRequest>) -> Result<Response<PingResponse>, Status> {
        let request = request.into_inner();
        let received_at_unix_nano = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos() as i64)
            .unwrap_or_default();

        Ok(Response::new(PingResponse {
            request_id: request.request_id,
            sent_at_unix_nano: request.sent_at_unix_nano,
            received_at_unix_nano,
        }))
    }

    async fn get_health(
        &self,
        _request: Request<HealthRequest>,
    ) -> Result<Response<HealthResponse>, Status> {
        let health = build_health(
            self.settings.service_name.as_str(),
            self.settings.version.as_str(),
            self.settings.port,
        );

        Ok(Response::new(HealthResponse {
            name: health.name,
            status: health.status,
            version: health.version,
            port: u32::from(health.port),
            url: health.url,
            checked_at: health.checked_at.to_rfc3339(),
            details: health.details,
        }))
    }

    async fn get_capabilities(
        &self,
        _request: Request<CapabilitiesRequest>,
    ) -> Result<Response<CapabilitiesResponse>, Status> {
        let capabilities = build_capabilities(
            self.settings.service_name.as_str(),
            self.settings.version.as_str(),
        );

        Ok(Response::new(CapabilitiesResponse {
            name: capabilities.name,
            version: capabilities.version,
            runtime: capabilities.runtime,
            capabilities: capabilities.capabilities,
        }))
    }
}

pub async fn run(settings: Settings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let address: SocketAddr = format!("0.0.0.0:{}", settings.grpc_port).parse()?;
    let service = EngineRuntimeService::new(settings);

    Server::builder()
        .add_service(EngineRuntimeServer::new(service))
        .serve(address)
        .await?;

    Ok(())
}
