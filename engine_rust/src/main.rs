use engine_rust::{config::Settings, http::build_router};

#[tokio::main]
async fn main() {
    let settings = Settings::from_env();
    let address = format!("0.0.0.0:{}", settings.port);
    let listener = tokio::net::TcpListener::bind(address)
        .await
        .expect("failed to bind engine listener");

    axum::serve(listener, build_router(settings))
        .await
        .expect("engine server failed");
}
