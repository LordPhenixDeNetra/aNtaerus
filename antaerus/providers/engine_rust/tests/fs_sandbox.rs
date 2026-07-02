use std::fs;

use engine_rust::{
    fs::{
        reader::read_text_file,
        sandbox::{FilesystemSandbox, FilesystemSandboxError},
    },
    tools_config::FilesystemToolConfig,
};
use tempfile::tempdir;

#[test]
fn filesystem_sandbox_reads_allowed_file() {
    let tempdir = tempdir().unwrap();
    let allowed_dir = tempdir.path().join("allowed");
    fs::create_dir_all(&allowed_dir).unwrap();
    let target_file = allowed_dir.join("hello.txt");
    fs::write(&target_file, "bonjour sandbox").unwrap();

    let sandbox = FilesystemSandbox::from_config(
        tempdir.path().to_path_buf(),
        &FilesystemToolConfig {
            enabled: true,
            allowed_roots: vec!["allowed".to_string()],
            max_bytes: 65_536,
        },
    )
    .unwrap();

    let result = read_text_file(&sandbox, "allowed/hello.txt", None).unwrap();
    assert_eq!(result.content, "bonjour sandbox");
    assert!(!result.truncated);
}

#[test]
fn filesystem_sandbox_rejects_path_outside_whitelist() {
    let tempdir = tempdir().unwrap();
    let allowed_dir = tempdir.path().join("allowed");
    let blocked_dir = tempdir.path().join("blocked");
    fs::create_dir_all(&allowed_dir).unwrap();
    fs::create_dir_all(&blocked_dir).unwrap();
    fs::write(blocked_dir.join("secret.txt"), "nope").unwrap();

    let sandbox = FilesystemSandbox::from_config(
        tempdir.path().to_path_buf(),
        &FilesystemToolConfig {
            enabled: true,
            allowed_roots: vec!["allowed".to_string()],
            max_bytes: 65_536,
        },
    )
    .unwrap();

    let error = read_text_file(&sandbox, "blocked/secret.txt", None).unwrap_err();
    assert!(matches!(
        error,
        engine_rust::fs::reader::FileReaderError::Sandbox(
            FilesystemSandboxError::PathNotAllowed(_)
        )
    ));
}

#[test]
fn filesystem_sandbox_rejects_empty_whitelist() {
    let tempdir = tempdir().unwrap();
    let error = FilesystemSandbox::from_config(
        tempdir.path().to_path_buf(),
        &FilesystemToolConfig {
            enabled: true,
            allowed_roots: vec![],
            max_bytes: 65_536,
        },
    )
    .unwrap_err();

    assert!(matches!(error, FilesystemSandboxError::NotConfigured(_)));
}
