use std::io::Read;
use std::path::Path;

use thiserror::Error;

use crate::fs::sandbox::{FilesystemSandbox, FilesystemSandboxError};

#[derive(Debug, Clone)]
pub struct FileReadResult {
    pub path: String,
    pub content: String,
    pub size: usize,
    pub truncated: bool,
}

#[derive(Debug, Error)]
pub enum FileReaderError {
    #[error(transparent)]
    Sandbox(#[from] FilesystemSandboxError),
    #[error("failed to open file {path}: {source}")]
    Open {
        path: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to read file {path}: {source}")]
    Read {
        path: String,
        #[source]
        source: std::io::Error,
    },
}

pub fn read_text_file(
    sandbox: &FilesystemSandbox,
    requested_path: impl AsRef<Path>,
    max_bytes: Option<usize>,
) -> Result<FileReadResult, FileReaderError> {
    let resolved = sandbox.resolve_file_path(requested_path)?;
    let allowed_root = sandbox.open_allowed_root(resolved.allowed_root.as_path())?;
    let mut file = allowed_root
        .open(resolved.relative_path.as_path())
        .map_err(|source| FileReaderError::Open {
            path: resolved.absolute_path.display().to_string(),
            source,
        })?;

    let mut raw = Vec::new();
    file.read_to_end(&mut raw)
        .map_err(|source| FileReaderError::Read {
            path: resolved.absolute_path.display().to_string(),
            source,
        })?;

    let effective_max_bytes = max_bytes.unwrap_or_else(|| sandbox.max_bytes());
    let sliced = &raw[..raw.len().min(effective_max_bytes)];
    Ok(FileReadResult {
        path: resolved.absolute_path.display().to_string(),
        content: String::from_utf8_lossy(sliced).to_string(),
        size: raw.len(),
        truncated: raw.len() > sliced.len(),
    })
}
