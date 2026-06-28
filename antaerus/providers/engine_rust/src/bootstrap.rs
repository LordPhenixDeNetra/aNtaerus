use crate::{config::Settings, grpc_service, http::build_router};

pub async fn run() {
    let settings = Settings::from_env();
    let http_settings = settings.clone();
    let grpc_settings = settings.clone();

    tokio::try_join!(run_http(http_settings), grpc_service::run(grpc_settings))
        .expect("engine services failed");
}

async fn run_http(settings: Settings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let address = format!("0.0.0.0:{}", settings.port);
    let listener = tokio::net::TcpListener::bind(address).await?;

    axum::serve(listener, build_router(settings)).await?;
    Ok(())
}
