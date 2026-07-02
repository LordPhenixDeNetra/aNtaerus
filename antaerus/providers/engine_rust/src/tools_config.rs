use std::{fs, path::{Path, PathBuf}};

use serde::Deserialize;
use thiserror::Error;

#[derive(Debug, Clone, Deserialize)]
pub struct FilesystemToolConfig {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub allowed_roots: Vec<String>,
    #[serde(default = "default_max_bytes")]
    pub max_bytes: usize,
}

impl Default for FilesystemToolConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            allowed_roots: Vec::new(),
            max_bytes: default_max_bytes(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct CliToolConfig {
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub allowed_commands: Vec<String>,
    #[serde(default)]
    pub timeout_seconds: Option<f64>,
}

impl Default for CliToolConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            allowed_commands: Vec::new(),
            timeout_seconds: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ToolsConfig {
    #[serde(default)]
    pub filesystem: FilesystemToolConfig,
    #[serde(default)]
    pub cli: CliToolConfig,
}

#[derive(Debug, Error)]
pub enum ToolsConfigError {
    #[error("tools config not found: {0}")]
    NotFound(PathBuf),
    #[error("failed to read tools config {path}: {source}")]
    Read {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to parse tools config {path}: {source}")]
    Parse {
        path: PathBuf,
        #[source]
        source: serde_yaml::Error,
    },
}

pub fn load_tools_config(path: &Path) -> Result<ToolsConfig, ToolsConfigError> {
    if !path.exists() {
        return Err(ToolsConfigError::NotFound(path.to_path_buf()));
    }

    let raw = fs::read_to_string(path).map_err(|source| ToolsConfigError::Read {
        path: path.to_path_buf(),
        source,
    })?;
    serde_yaml::from_str(raw.as_str()).map_err(|source| ToolsConfigError::Parse {
        path: path.to_path_buf(),
        source,
    })
}

pub fn load_tools_config_or_default(path: &Path) -> ToolsConfig {
    load_tools_config(path).unwrap_or_default()
}

fn default_enabled() -> bool {
    true
}

fn default_max_bytes() -> usize {
    65_536
}
