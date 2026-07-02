use std::time::Duration;

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

use crate::{
    cli::sandbox::{CliSandbox, CliSandboxError},
    config::Settings,
    fs::{
        reader::{read_text_file, FileReaderError},
        sandbox::FilesystemSandbox,
    },
};

#[derive(Debug, Deserialize)]
pub struct FilesystemReadRequest {
    pub path: String,
    #[serde(default = "default_encoding")]
    pub encoding: String,
    #[serde(default)]
    pub max_bytes: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct CliExecuteRequest {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub timeout_seconds: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct ToolHttpResponse {
    pub ok: bool,
    pub tool: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default)]
    pub meta: serde_json::Map<String, serde_json::Value>,
}

pub async fn filesystem_read(
    State(settings): State<Settings>,
    Json(payload): Json<FilesystemReadRequest>,
) -> impl IntoResponse {
    let settings_for_task = settings.clone();
    let result = tokio::task::spawn_blocking(move || {
        let sandbox = FilesystemSandbox::from_settings(&settings_for_task)?;
        let outcome = read_text_file(
            &sandbox,
            payload.path.as_str(),
            payload.max_bytes,
        )?;
        Ok::<ToolHttpResponse, FilesystemOrReaderError>(ToolHttpResponse {
            ok: true,
            tool: "filesystem".to_string(),
            status: "ok".to_string(),
            result: Some(serde_json::json!({
                "path": outcome.path,
                "content": decode_for_encoding(outcome.content, payload.encoding.as_str()),
                "size": outcome.size,
                "truncated": outcome.truncated
            })),
            error: None,
            meta: serde_json::Map::new(),
        })
    })
    .await;

    match result {
        Ok(Ok(response)) => (StatusCode::OK, Json(response)).into_response(),
        Ok(Err(error)) => map_filesystem_error(error).into_response(),
        Err(join_error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(error_response(
                "filesystem",
                "error",
                format!("filesystem task failed: {join_error}"),
            )),
        )
            .into_response(),
    }
}

pub async fn cli_execute(
    State(settings): State<Settings>,
    Json(payload): Json<CliExecuteRequest>,
) -> impl IntoResponse {
    let settings_for_task = settings.clone();
    let result = tokio::task::spawn_blocking(move || {
        let sandbox = CliSandbox::from_settings(&settings_for_task)?;
        let outcome = sandbox.execute(
            payload.command.as_str(),
            payload.args.as_slice(),
            payload.timeout_seconds.map(Duration::from_secs_f64),
        )?;
        Ok::<ToolHttpResponse, CliSandboxError>(ToolHttpResponse {
            ok: true,
            tool: "cli".to_string(),
            status: "ok".to_string(),
            result: Some(serde_json::json!({
                "command": outcome.command,
                "args": outcome.args,
                "exitCode": outcome.exit_code,
                "stdout": outcome.stdout,
                "stderr": outcome.stderr
            })),
            error: None,
            meta: serde_json::Map::new(),
        })
    })
    .await;

    match result {
        Ok(Ok(response)) => (StatusCode::OK, Json(response)).into_response(),
        Ok(Err(error)) => map_cli_error(error).into_response(),
        Err(join_error) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(error_response(
                "cli",
                "error",
                format!("cli task failed: {join_error}"),
            )),
        )
            .into_response(),
    }
}

#[derive(Debug, thiserror::Error)]
enum FilesystemOrReaderError {
    #[error(transparent)]
    Sandbox(#[from] crate::fs::sandbox::FilesystemSandboxError),
    #[error(transparent)]
    Reader(#[from] FileReaderError),
}

fn map_filesystem_error(error: FilesystemOrReaderError) -> (StatusCode, Json<ToolHttpResponse>) {
    let response = match error {
        FilesystemOrReaderError::Sandbox(sandbox_error) => match sandbox_error {
            crate::fs::sandbox::FilesystemSandboxError::Disabled => {
                error_response("filesystem", "denied", sandbox_error.to_string())
            }
            crate::fs::sandbox::FilesystemSandboxError::NotConfigured(_) => {
                error_response("filesystem", "not_configured", sandbox_error.to_string())
            }
            crate::fs::sandbox::FilesystemSandboxError::PathNotAllowed(_) => {
                error_response("filesystem", "denied", sandbox_error.to_string())
            }
            crate::fs::sandbox::FilesystemSandboxError::FileNotFound(_) => {
                error_response("filesystem", "error", sandbox_error.to_string())
            }
            crate::fs::sandbox::FilesystemSandboxError::ResolvePath { .. }
            | crate::fs::sandbox::FilesystemSandboxError::OpenAllowedRoot { .. } => {
                error_response("filesystem", "error", sandbox_error.to_string())
            }
        },
        FilesystemOrReaderError::Reader(reader_error) => match reader_error {
            FileReaderError::Sandbox(sandbox_error) => {
                return map_filesystem_error(FilesystemOrReaderError::Sandbox(sandbox_error));
            }
            FileReaderError::Open { .. } | FileReaderError::Read { .. } => {
                error_response("filesystem", "error", reader_error.to_string())
            }
        },
    };
    (StatusCode::BAD_REQUEST, Json(response))
}

fn map_cli_error(error: CliSandboxError) -> (StatusCode, Json<ToolHttpResponse>) {
    let response = match error {
        CliSandboxError::Disabled => error_response("cli", "denied", error.to_string()),
        CliSandboxError::NotConfigured(_) => {
            error_response("cli", "not_configured", error.to_string())
        }
        CliSandboxError::CommandNotAllowed(_) => error_response("cli", "denied", error.to_string()),
        CliSandboxError::Timeout { .. } => error_response("cli", "error", error.to_string()),
        CliSandboxError::Spawn { .. }
        | CliSandboxError::Kill { .. }
        | CliSandboxError::Wait { .. } => error_response("cli", "error", error.to_string()),
    };
    (StatusCode::BAD_REQUEST, Json(response))
}

fn error_response(tool: &str, status: &str, message: String) -> ToolHttpResponse {
    ToolHttpResponse {
        ok: false,
        tool: tool.to_string(),
        status: status.to_string(),
        result: None,
        error: Some(message),
        meta: serde_json::Map::new(),
    }
}

fn default_encoding() -> String {
    "utf-8".to_string()
}

fn decode_for_encoding(content: String, _encoding: &str) -> String {
    content
}
