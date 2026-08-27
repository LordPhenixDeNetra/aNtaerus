use axum::{extract::State, routing::{get, post}, Json, Router};

use crate::{
    config::Settings,
    http_tools::{cli_execute, filesystem_list_dir, filesystem_read},
    state::{build_capabilities, build_health, ServiceCapabilities, ServiceHealth},
};

pub fn build_router(settings: Settings) -> Router {
    Router::new()
        .route("/health", get(healthcheck))
        .route("/capabilities", get(capabilities))
        .route("/internal/tools/filesystem/read", post(filesystem_read))
        .route("/internal/tools/filesystem/list_dir", post(filesystem_list_dir))
        .route("/internal/tools/cli/execute", post(cli_execute))
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
