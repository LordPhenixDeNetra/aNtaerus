use std::{env, fs, path::{Path, PathBuf}};

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

fn merge_tools_config(base: ToolsConfig, overlay: ToolsConfig) -> ToolsConfig {
    // Merging rules: overlay booleans win if NOT default true / same as base. Allowed roots / commands are APPENDED.
    let mut filesystem = base.filesystem;
    if !overlay.filesystem.enabled {
        filesystem.enabled = false;
    }
    let mut merged_roots: Vec<String> = filesystem.allowed_roots;
    merged_roots.extend(overlay.filesystem.allowed_roots);
    // dedup preserving order (first occurrence wins)
    merged_roots = {
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for r in merged_roots {
            if seen.insert(r.clone()) {
                out.push(r);
            }
        }
        out
    };
    filesystem.allowed_roots = merged_roots;
    if overlay.filesystem.max_bytes != default_max_bytes() {
        filesystem.max_bytes = overlay.filesystem.max_bytes;
    }

    let mut cli = base.cli;
    if !overlay.cli.enabled {
        cli.enabled = false;
    }
    let mut merged_commands: Vec<String> = cli.allowed_commands;
    merged_commands.extend(overlay.cli.allowed_commands);
    merged_commands = {
        let mut seen = std::collections::HashSet::new();
        let mut out = Vec::new();
        for c in merged_commands {
            if seen.insert(c.clone()) {
                out.push(c);
            }
        }
        out
    };
    cli.allowed_commands = merged_commands;
    if overlay.cli.timeout_seconds.is_some() {
        cli.timeout_seconds = overlay.cli.timeout_seconds;
    }

    ToolsConfig { filesystem, cli }
}

fn parse_env_paths(env_str: &str) -> Vec<String> {
    if env_str.is_empty() {
        return Vec::new();
    }
    // Separators: highest priority = ";;" (universal), then ";" (Windows), then ":" (Unix)
    let parts: Vec<&str> = if env_str.contains(";;") {
        env_str.split(";;").collect()
    } else if cfg!(windows) || (env_str.contains(';') && !env_str.replace("://", "").contains(':')) {
        env_str.split(';').collect()
    } else {
        env_str.split(':').collect()
    };
    parts
        .into_iter()
        .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
        .filter(|s| !s.is_empty() && s.len() > 1 && s.to_lowercase() != "x")
        .collect()
}

fn normalize_allowed_root(root: &str, sandbox_root: &Path) -> Option<String> {
    let candidate = if root.is_empty() {
        return None;
    } else {
        let expanded = shellexpand_env(root);
        let p = PathBuf::from(&expanded);
        if p.is_absolute() {
            p
        } else {
            sandbox_root.join(p)
        }
    };
    match dunce::canonicalize(&candidate).or_else(|_| candidate.canonicalize()) {
        Ok(resolved) => Some(resolved.to_string_lossy().to_string()),
        Err(_) => Some(candidate.to_string_lossy().to_string()),
    }
}

fn shellexpand_env(input: &str) -> String {
    // Best-effort %VAR% / $VAR / ${VAR} expansion (matches os.env on Windows and Unix)
    let mut out = String::with_capacity(input.len());
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '%' && cfg!(windows) {
            // %NAME%
            if let Some(end) = chars[i + 1..].iter().position(|x| *x == '%') {
                let name: String = chars[i + 1..i + 1 + end].iter().collect();
                if let Ok(val) = env::var(&name) {
                    out.push_str(&val);
                    i = i + 1 + end + 1;
                    continue;
                }
            }
            out.push(c);
            i += 1;
        } else if c == '$' {
            // ${NAME} or $NAME
            if i + 1 < chars.len() && chars[i + 1] == '{' {
                if let Some(end) = chars[i + 2..].iter().position(|x| *x == '}') {
                    let name: String = chars[i + 2..i + 2 + end].iter().collect();
                    if let Ok(val) = env::var(&name) {
                        out.push_str(&val);
                        i = i + 2 + end + 1;
                        continue;
                    }
                }
            } else {
                // $NAME up to non-alphanumeric
                let mut j = i + 1;
                while j < chars.len() && (chars[j].is_alphanumeric() || chars[j] == '_') {
                    j += 1;
                }
                if j > i + 1 {
                    let name: String = chars[i + 1..j].iter().collect();
                    if let Ok(val) = env::var(&name) {
                        out.push_str(&val);
                        i = j;
                        continue;
                    }
                }
            }
            out.push(c);
            i += 1;
        } else {
            out.push(c);
            i += 1;
        }
    }
    out
}

fn dedup_normalize(roots: Vec<String>, sandbox_root: &Path) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for r in roots {
        if let Some(norm) = normalize_allowed_root(&r, sandbox_root) {
            if seen.insert(norm.clone()) {
                out.push(norm);
            }
        }
    }
    out
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
    load_tools_config_with_sandbox(path, None)
}

pub fn load_tools_config_with_sandbox(
    path: &Path,
    sandbox_root_override: Option<&Path>,
) -> Result<ToolsConfig, ToolsConfigError> {
    if !path.exists() {
        return Err(ToolsConfigError::NotFound(path.to_path_buf()));
    }
    // -- Load base tools.yaml
    let raw = fs::read_to_string(path).map_err(|source| ToolsConfigError::Read {
        path: path.to_path_buf(),
        source,
    })?;
    let base: ToolsConfig =
        serde_yaml::from_str(raw.as_str()).map_err(|source| ToolsConfigError::Parse {
            path: path.to_path_buf(),
            source,
        })?;

    // -- Load overlay tools.user.yaml (next to tools.yaml)
    let overlay_path = path.with_file_name("tools.user.yaml");
    let mut merged = if overlay_path.exists() {
        match fs::read_to_string(&overlay_path) {
            Ok(raw_overlay) => match serde_yaml::from_str::<ToolsConfig>(&raw_overlay) {
                Ok(overlay) => merge_tools_config(base, overlay),
                Err(_) => base,
            },
            Err(_) => base,
        }
    } else {
        base
    };

    // -- Compute sandbox_root (required for resolving relative paths)
    let sandbox_root = sandbox_root_override
        .map(|p| p.to_path_buf())
        .or_else(|| {
            env::var("ANTAERUS_ENGINE_TOOLS_SANDBOX_ROOT")
                .ok()
                .map(PathBuf::from)
        })
        .unwrap_or_else(|| {
            path.parent()
                .map(|p| p.join("sandbox"))
                .unwrap_or_else(|| PathBuf::from("./sandbox"))
        });

    // -- Merge env var ANTAERUS_TOOLS_FS_ALLOWED_ROOTS (highest priority, added LAST)
    if let Ok(env_str) = env::var("ANTAERUS_TOOLS_FS_ALLOWED_ROOTS") {
        merged.filesystem.allowed_roots.extend(parse_env_paths(&env_str));
    }

    // -- Dedup + normalize all allowed_roots final
    merged.filesystem.allowed_roots =
        dedup_normalize(merged.filesystem.allowed_roots, &sandbox_root);

    Ok(merged)
}

pub fn load_tools_config_or_default(path: &Path) -> ToolsConfig {
    load_tools_config_with_sandbox(path, None).unwrap_or_default()
}

pub fn load_tools_config_or_default_with_sandbox(path: &Path, sandbox_root: &Path) -> ToolsConfig {
    load_tools_config_with_sandbox(path, Some(sandbox_root)).unwrap_or_default()
}

fn default_enabled() -> bool {
    true
}

fn default_max_bytes() -> usize {
    65_536
}

