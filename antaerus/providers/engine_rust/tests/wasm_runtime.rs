#![cfg(feature = "wasm-runtime")]

use std::fs;

use engine_rust::sandbox::wasm::{WasmRuntime, WasmRuntimeError};
use tempfile::tempdir;

#[test]
fn wasm_runtime_executes_simple_export() {
    let tempdir = tempdir().unwrap();
    let module_path = tempdir.path().join("sample.wasm");
    let module = wat::parse_str(
        r#"
        (module
          (func (export "run") (result i32)
            i32.const 7))
        "#,
    )
    .unwrap();
    fs::write(&module_path, module).unwrap();

    let runtime = WasmRuntime::new(tempdir.path().to_path_buf());
    let result = runtime.execute_i32_export("sample.wasm", "run").unwrap();

    assert_eq!(result, 7);
}

#[test]
fn wasm_runtime_rejects_module_outside_sandbox_root() {
    let sandbox_root = tempdir().unwrap();
    let external_root = tempdir().unwrap();
    let external_module = external_root.path().join("external.wasm");
    let module = wat::parse_str(
        r#"
        (module
          (func (export "run") (result i32)
            i32.const 1))
        "#,
    )
    .unwrap();
    fs::write(&external_module, module).unwrap();

    let runtime = WasmRuntime::new(sandbox_root.path().to_path_buf());
    let error = runtime.execute_i32_export(&external_module, "run").unwrap_err();

    assert!(matches!(error, WasmRuntimeError::ModulePathNotAllowed(_)));
}

#[test]
fn wasm_runtime_rejects_invalid_module() {
    let tempdir = tempdir().unwrap();
    let module_path = tempdir.path().join("invalid.wasm");
    fs::write(&module_path, b"not a wasm module").unwrap();

    let runtime = WasmRuntime::new(tempdir.path().to_path_buf());
    let error = runtime.execute_i32_export("invalid.wasm", "run").unwrap_err();

    assert!(matches!(error, WasmRuntimeError::LoadModule { .. }));
}
