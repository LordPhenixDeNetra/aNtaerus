use axum::{body::Body, http::Request};
use engine_rust::{config::Settings, http::build_router};
use tower::util::ServiceExt;

#[tokio::test]
async fn health_endpoint_returns_engine_identity() {
    let app = build_router(Settings::from_env());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
}

#[tokio::test]
async fn capabilities_endpoint_is_available() {
    let app = build_router(Settings::from_env());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/capabilities")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), 200);
}
