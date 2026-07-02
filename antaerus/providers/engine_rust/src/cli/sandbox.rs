use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};

use thiserror::Error;
use wait_timeout::ChildExt;

use crate::{
    config::Settings,
    tools_config::{load_tools_config_or_default, CliToolConfig},
};

#[derive(Debug, Clone)]
pub struct CliSandbox {
    sandbox_root: PathBuf,
    allowed_commands: HashSet<String>,
    timeout: Duration,
}

#[derive(Debug, Clone)]
pub struct CliExecutionResult {
    pub command: String,
    pub args: Vec<String>,
    pub exit_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Error)]
pub enum CliSandboxError {
    #[error("cli tool is disabled in config")]
    Disabled,
    #[error("{0}")]
    NotConfigured(String),
    #[error("command not allowed: {0}")]
    CommandNotAllowed(String),
    #[error("failed to spawn command {command}: {source}")]
    Spawn {
        command: String,
        #[source]
        source: std::io::Error,
    },
    #[error("command timed out: {command}")]
    Timeout { command: String },
    #[error("failed to terminate timed out command {command}: {source}")]
    Kill {
        command: String,
        #[source]
        source: std::io::Error,
    },
    #[error("failed while waiting command {command}: {source}")]
    Wait {
        command: String,
        #[source]
        source: std::io::Error,
    },
}

impl CliSandbox {
    pub fn from_settings(settings: &Settings) -> Result<Self, CliSandboxError> {
        let config = load_tools_config_or_default(settings.tools_config_path.as_path());
        Self::from_config(
            settings.tools_sandbox_root.clone(),
            &config.cli,
            Duration::from_secs(15),
        )
    }

    pub fn from_config(
        sandbox_root: PathBuf,
        config: &CliToolConfig,
        default_timeout: Duration,
    ) -> Result<Self, CliSandboxError> {
        if !config.enabled {
            return Err(CliSandboxError::Disabled);
        }

        let allowed_commands = config
            .allowed_commands
            .iter()
            .map(normalize_command_name)
            .collect::<HashSet<_>>();
        if allowed_commands.is_empty() {
            return Err(CliSandboxError::NotConfigured(
                "cli allowed_commands is empty".to_string(),
            ));
        }

        let timeout = config
            .timeout_seconds
            .map(Duration::from_secs_f64)
            .unwrap_or(default_timeout);

        Ok(Self {
            sandbox_root,
            allowed_commands,
            timeout,
        })
    }

    pub fn timeout(&self) -> Duration {
        self.timeout
    }

    pub fn execute(
        &self,
        command: impl AsRef<Path>,
        args: &[String],
        timeout_override: Option<Duration>,
    ) -> Result<CliExecutionResult, CliSandboxError> {
        let command_path = command.as_ref();
        let command_name = command_path.display().to_string();
        let normalized_command = normalize_command_name(command_path);
        if !self.allowed_commands.contains(normalized_command.as_str()) {
            return Err(CliSandboxError::CommandNotAllowed(command_name));
        }

        let mut child = Command::new(command_path)
            .args(args)
            .current_dir(self.sandbox_root.as_path())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|source| CliSandboxError::Spawn {
                command: command_name.clone(),
                source,
            })?;

        let effective_timeout = timeout_override.unwrap_or(self.timeout);
        let completed = child
            .wait_timeout(effective_timeout)
            .map_err(|source| CliSandboxError::Wait {
                command: command_name.clone(),
                source,
            })?;
        if completed.is_none() {
            child.kill().map_err(|source| CliSandboxError::Kill {
                command: command_name.clone(),
                source,
            })?;
            let _ = child.wait().map_err(|source| CliSandboxError::Wait {
                command: command_name.clone(),
                source,
            })?;
            return Err(CliSandboxError::Timeout {
                command: command_name,
            });
        }

        let output = child.wait_with_output().map_err(|source| CliSandboxError::Wait {
            command: command_name.clone(),
            source,
        })?;
        Ok(CliExecutionResult {
            command: command_path.display().to_string(),
            args: args.to_vec(),
            exit_code: output.status.code(),
            stdout: String::from_utf8_lossy(output.stdout.as_slice()).to_string(),
            stderr: String::from_utf8_lossy(output.stderr.as_slice()).to_string(),
        })
    }
}

pub fn normalize_command_name(command: impl AsRef<Path>) -> String {
    let mut basename = command
        .as_ref()
        .file_name()
        .unwrap_or_else(|| command.as_ref().as_os_str())
        .to_string_lossy()
        .to_lowercase();
    if basename.ends_with(".exe") {
        basename.truncate(basename.len() - 4);
    }
    basename
}
