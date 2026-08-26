use std::path::{Path, PathBuf};

use cap_std::{ambient_authority, fs::Dir};
use thiserror::Error;

use crate::{
    config::Settings,
    tools_config::{load_tools_config_or_default, FilesystemToolConfig},
};

#[derive(Debug, Clone)]
pub struct FilesystemSandbox {
    sandbox_root: PathBuf,
    allowed_roots: Vec<PathBuf>,
    max_bytes: usize,
}

#[derive(Debug, Clone)]
pub struct ResolvedFilePath {
    pub absolute_path: PathBuf,
    pub allowed_root: PathBuf,
    pub relative_path: PathBuf,
}

#[derive(Debug, Error)]
pub enum FilesystemSandboxError {
    #[error("filesystem tool is disabled in config")]
    Disabled,
    #[error("{0}")]
    NotConfigured(String),
    #[error("path not allowed: {0}")]
    PathNotAllowed(PathBuf),
    #[error("file not found: {0}")]
    FileNotFound(PathBuf),
    #[error("failed to resolve path {path}: {source}")]
    ResolvePath {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to open allowed root {path}: {source}")]
    OpenAllowedRoot {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}

impl FilesystemSandbox {
    pub fn from_settings(settings: &Settings) -> Result<Self, FilesystemSandboxError> {
        let config = load_tools_config_or_default_with_sandbox(
            settings.tools_config_path.as_path(),
            settings.tools_sandbox_root.as_path(),
        );
        Self::from_config(
            settings.tools_sandbox_root.clone(),
            &config.filesystem,
        )
    }

    pub fn from_config(
        sandbox_root: PathBuf,
        config: &FilesystemToolConfig,
    ) -> Result<Self, FilesystemSandboxError> {
        if !config.enabled {
            return Err(FilesystemSandboxError::Disabled);
        }

        let allowed_roots = resolve_allowed_roots(sandbox_root.as_path(), &config.allowed_roots);
        if allowed_roots.is_empty() {
            return Err(FilesystemSandboxError::NotConfigured(
                "filesystem allowed_roots is empty".to_string(),
            ));
        }

        Ok(Self {
            sandbox_root,
            allowed_roots,
            max_bytes: config.max_bytes,
        })
    }

    pub fn max_bytes(&self) -> usize {
        self.max_bytes
    }

    pub fn resolve_file_path(
        &self,
        requested_path: impl AsRef<Path>,
    ) -> Result<ResolvedFilePath, FilesystemSandboxError> {
        let requested_path = requested_path.as_ref();
        let absolute_candidate = if requested_path.is_absolute() {
            requested_path.to_path_buf()
        } else {
            self.sandbox_root.join(requested_path)
        };
        if !absolute_candidate.exists() || !absolute_candidate.is_file() {
            return Err(FilesystemSandboxError::FileNotFound(absolute_candidate));
        }

        let absolute_path = absolute_candidate
            .canonicalize()
            .map_err(|source| FilesystemSandboxError::ResolvePath {
                path: absolute_candidate.clone(),
                source,
            })?;

        for allowed_root in &self.allowed_roots {
            if let Ok(relative_path) = absolute_path.strip_prefix(allowed_root) {
                return Ok(ResolvedFilePath {
                    absolute_path: absolute_path.clone(),
                    allowed_root: allowed_root.clone(),
                    relative_path: relative_path.to_path_buf(),
                });
            }
        }

        Err(FilesystemSandboxError::PathNotAllowed(absolute_path))
    }

    pub fn open_allowed_root(&self, root: &Path) -> Result<Dir, FilesystemSandboxError> {
        Dir::open_ambient_dir(root, ambient_authority()).map_err(|source| {
            FilesystemSandboxError::OpenAllowedRoot {
                path: root.to_path_buf(),
                source,
            }
        })
    }
}

pub fn resolve_allowed_roots(sandbox_root: &Path, allowed_roots: &[String]) -> Vec<PathBuf> {
    let mut resolved = Vec::new();
    for entry in allowed_roots {
        let candidate = PathBuf::from(entry);
        let candidate = if candidate.is_absolute() {
            candidate
        } else {
            sandbox_root.join(candidate)
        };
        resolved.push(candidate.canonicalize().unwrap_or(candidate));
    }
    resolved
}
