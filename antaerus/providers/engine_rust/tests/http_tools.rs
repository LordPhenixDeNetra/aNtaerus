use std::{env, ffi::OsString, fs};

use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use engine_rust::{config::Settings, http::build_router};
use tempfile::tempdir;
use tower::util::ServiceExt;

#[tokio::test]
async fn filesystem_http_endpoint_reads_allowed_file() {
    let tempdir = tempdir().unwrap();
    let allowed = tempdir.path().join("docs");
    fs::create_dir_all(&allowed).unwrap();
    fs::write(allowed.join("note.txt"), "bonjour rust").unwrap();
    let tools_config = tempdir.path().join("tools.yaml");
    fs::write(
        &tools_config,
        "filesystem:\n  enabled: true\n  allowed_roots:\n    - docs\n  max_bytes: 65536\ncli:\n  enabled: true\n  allowed_commands:\n    - rustc\n",
    )
    .unwrap();

    let mut settings = Settings::from_env();
    settings.tools_config_path = tools_config;
    settings.tools_sandbox_root = tempdir.path().to_path_buf();

    let app = build_router(settings);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/internal/tools/filesystem/read")
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"path":"docs/note.txt","encoding":"utf-8","max_bytes":1024}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), 1024 * 64).await.unwrap();
    let payload = String::from_utf8(body.to_vec()).unwrap();
    assert!(payload.contains("\"tool\":\"filesystem\""));
    assert!(payload.contains("bonjour rust"));
}

#[tokio::test]
async fn cli_http_endpoint_executes_whitelisted_command() {
    let tempdir = tempdir().unwrap();
    let tools_config = tempdir.path().join("tools.yaml");
    fs::write(
        &tools_config,
        "filesystem:\n  enabled: true\n  allowed_roots:\n    - docs\n  max_bytes: 65536\ncli:\n  enabled: true\n  allowed_commands:\n    - rustc\n  timeout_seconds: 5\n",
    )
    .unwrap();

    let mut settings = Settings::from_env();
    settings.tools_config_path = tools_config;
    settings.tools_sandbox_root = tempdir.path().to_path_buf();

    let command = env::var_os("RUSTC")
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| OsString::from("rustc").to_string_lossy().to_string());
    let request_body = serde_json::json!({
        "command": command,
        "args": ["--version"]
    });

    let app = build_router(settings);
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/internal/tools/cli/execute")
                .header("content-type", "application/json")
                .body(Body::from(request_body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), 1024 * 64).await.unwrap();
    let payload = String::from_utf8(body.to_vec()).unwrap();
    assert!(payload.contains("\"tool\":\"cli\""));
    assert!(payload.contains("rustc"));
}
