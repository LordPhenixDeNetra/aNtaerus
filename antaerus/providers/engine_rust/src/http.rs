use axum::{extract::State, routing::get, Json, Router};

use crate::{
    config::Settings,
    state::{build_capabilities, build_health, ServiceCapabilities, ServiceHealth},
};

pub fn build_router(settings: Settings) -> Router {
    Router::new()
        .route("/health", get(healthcheck))
        .route("/capabilities", get(capabilities))
        .with_state(settings)
}

async fn healthcheck(State(settings): State<Settings>) -> Json<ServiceHealth> {
    Json(build_health(
        settings.service_name.as_str(),
        settings.version.as_str(),
        settings.port,
    ))
}

async fn capabilities(State(settings): State<Settings>) -> Json<ServiceCapabilities> {
    Json(build_capabilities(
        settings.service_name.as_str(),
        settings.version.as_str(),
    ))
}
