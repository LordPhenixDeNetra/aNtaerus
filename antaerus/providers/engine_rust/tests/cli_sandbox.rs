use std::{ffi::OsString, fs, path::PathBuf, time::Duration};

use engine_rust::{
    cli::sandbox::{CliSandbox, CliSandboxError},
    tools_config::CliToolConfig,
};
use tempfile::tempdir;

#[test]
fn cli_sandbox_executes_allowed_command() {
    let tempdir = tempdir().unwrap();
    let rustc = rustc_path();
    let sandbox = CliSandbox::from_config(
        tempdir.path().to_path_buf(),
        &CliToolConfig {
            enabled: true,
            allowed_commands: vec!["rustc".to_string()],
            timeout_seconds: Some(5.0),
        },
        Duration::from_secs(5),
    )
    .unwrap();

    let result = sandbox
        .execute(rustc, &["--version".to_string()], None)
        .unwrap();

    assert_eq!(result.exit_code, Some(0));
    assert!(result.stdout.contains("rustc"));
}

#[test]
fn cli_sandbox_rejects_non_whitelisted_command() {
    let tempdir = tempdir().unwrap();
    let sandbox = CliSandbox::from_config(
        tempdir.path().to_path_buf(),
        &CliToolConfig {
            enabled: true,
            allowed_commands: vec!["cargo".to_string()],
            timeout_seconds: Some(5.0),
        },
        Duration::from_secs(5),
    )
    .unwrap();

    let error = sandbox
        .execute(rustc_path(), &["--version".to_string()], None)
        .unwrap_err();

    assert!(matches!(error, CliSandboxError::CommandNotAllowed(_)));
}

#[test]
fn cli_sandbox_times_out_long_running_command() {
    let tempdir = tempdir().unwrap();
    let helper_source = tempdir.path().join("helper.rs");
    fs::write(
        &helper_source,
        "fn main() { std::thread::sleep(std::time::Duration::from_secs(2)); }",
    )
    .unwrap();
    let helper_binary = helper_binary_path(tempdir.path());

    let compile_status = std::process::Command::new(rustc_path())
        .args([
            helper_source.display().to_string(),
            "-o".to_string(),
            helper_binary.display().to_string(),
        ])
        .status()
        .unwrap();
    assert!(compile_status.success());

    let sandbox = CliSandbox::from_config(
        tempdir.path().to_path_buf(),
        &CliToolConfig {
            enabled: true,
            allowed_commands: vec!["helper".to_string()],
            timeout_seconds: Some(0.05),
        },
        Duration::from_secs(5),
    )
    .unwrap();

    let error = sandbox.execute(&helper_binary, &[], None).unwrap_err();
    assert!(matches!(error, CliSandboxError::Timeout { .. }));
}

fn rustc_path() -> PathBuf {
    std::env::var_os("RUSTC")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(OsString::from("rustc")))
}

fn helper_binary_path(root: &std::path::Path) -> PathBuf {
    if cfg!(windows) {
        root.join("helper.exe")
    } else {
        root.join("helper")
    }
}
