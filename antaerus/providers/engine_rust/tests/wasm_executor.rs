#![cfg(feature = "wasm-runtime")]

use engine_rust::sandbox::executor::{RunOutcome, WasmExecutor, WasmExecutorError, build_engine, call_i32_export_inner};
use engine_rust::sandbox::wasm::WasmRuntime;
use std::time::Instant;
use std::thread;
use std::sync::mpsc;
use tempfile::tempdir;
use wasmtime::{Linker, Module, Store};

fn run_wat_sync(wat: &str, fuel_limit: u64, timeout_ms: u64, arg: Option<i32>) -> Result<RunOutcome, WasmExecutorError> {
    let started = Instant::now();
    let bytes = WasmExecutor::compile_wat_to_wasm_bytes(wat)?;
    if bytes.is_empty() {
        return Err(WasmExecutorError::EmptyModule);
    }
    let owned_arg = arg.unwrap_or(0);
    let engine = build_engine()?;
    let module = Module::from_binary(&engine, &bytes).map_err(WasmExecutorError::CompileModule)?;
    let mut store = Store::new(&engine, ());
    store.set_fuel(fuel_limit).map_err(WasmExecutorError::Fuel)?;
    let linker = Linker::new(&engine);
    let instance = linker.instantiate(&mut store, &module).map_err(|e| {
        let _rem = store.get_fuel().unwrap_or(0);
        WasmExecutorError::Instantiate(e)
    })?;
    let (call_result, remaining_fuel) =
        match call_i32_export_inner(&mut store, &instance, "run", owned_arg) {
            Ok((v, r)) => (Ok(v), r),
            Err((e, r)) => (Err(e), r),
        };
    let elapsed = started.elapsed();
    if elapsed.as_millis() as u64 > timeout_ms {
        return Err(WasmExecutorError::Timeout { ms: timeout_ms });
    }
    let fuel_used = fuel_limit.saturating_sub(remaining_fuel);
    match call_result {
        Ok(value) => {
            let stdout = format!(
                "{{\"result\":{},\"runtime\":\"wasm\",\"fuel_used\":{},\"exit\":0}}",
                value, fuel_used
            );
            Ok(RunOutcome {
                exit_code: 0,
                stdout,
                stderr: String::new(),
                fuel_used,
                duration_ms: elapsed.as_millis() as u64,
            })
        }
        Err(WasmExecutorError::Call { export, source }) => {
            let msg = source.to_string();
            if (msg.contains("fuel") || msg.contains("Fuel") || msg.contains("trap"))
                && fuel_used >= fuel_limit.saturating_sub(1)
            {
                return Err(WasmExecutorError::OutOfFuel {
                    used: fuel_used,
                    limit: fuel_limit,
                });
            }
            Err(WasmExecutorError::Call { export, source })
        }
        Err(other) => Err(other),
    }
}

fn run_wat_with_stack<F, R>(wat: &str, fuel_limit: u64, timeout_ms: u64, arg: Option<i32>, map: F) -> R
where
    F: FnOnce(Result<RunOutcome, WasmExecutorError>) -> R + Send + 'static,
    R: Send + 'static,
{
    let wat_owned: String = wat.to_string();
    let (tx, rx) = mpsc::channel::<R>();
    let _join = thread::Builder::new()
        .stack_size(64 * 1024 * 1024)
        .spawn(move || {
            let res = run_wat_sync(&wat_owned, fuel_limit, timeout_ms, arg);
            let mapped = map(res);
            let _ = tx.send(mapped);
        })
        .unwrap();
    rx.recv().expect("thread send")
}

#[tokio::test(flavor = "current_thread")]
async fn executor_compiles_wat_and_runs_plus_42() {
    let wat = r#"
(module
  (func (export "run") (param i32) (result i32)
    local.get 0
    i32.const 42
    i32.add)
  (memory (export "memory") 1))
"#;
    let outcome: RunOutcome = run_wat_with_stack(
        wat,
        250_000,
        30_000,
        Some(1),
        |res| res.expect("run wat sync"),
    );
    assert_eq!(outcome.exit_code, 0);
    assert!(outcome.stdout.contains("\"result\":43"));
    assert!(outcome.fuel_used > 0);
    assert!(outcome.duration_ms < 30_000);
}

#[tokio::test(flavor = "current_thread")]
async fn executor_tracks_fuel_used_on_multi_step_module() {
    let wat = r#"
(module
  (func (export "run") (result i32)
    (local i32)
    (local.set 0 (i32.const 0))
    (loop $top
      (local.set 0 (i32.add (local.get 0) (i32.const 1)))
      (br_if $top (i32.lt_s (local.get 0) (i32.const 100))))
    (local.get 0)))
"#;
    let outcome: RunOutcome = run_wat_with_stack(
        wat,
        250_000,
        30_000,
        None,
        |res| res.expect("run wat sync fuel tracking"),
    );
    assert_eq!(outcome.exit_code, 0);
    assert!(outcome.stdout.contains("\"result\":100"));
    assert!(outcome.fuel_used > 0, "fuel should be consumed");
    assert!(
        outcome.fuel_used < 250_000,
        "fuel used {} must be below limit",
        outcome.fuel_used
    );
    assert!(outcome.duration_ms < 30_000);
}

#[tokio::test(flavor = "current_thread")]
async fn executor_errors_on_empty_module() {
    let executor = WasmExecutor::with_defaults();
    let err = executor
        .run_i32_bytes(&[], None)
        .await
        .expect_err("expected empty");
    assert!(matches!(err, WasmExecutorError::EmptyModule));
}

#[tokio::test(flavor = "current_thread")]
async fn runtime_runs_wasm_file_via_executor() {
    let wat = r#"
(module
  (func (export "run") (result i32)
    i32.const 99))
"#;
    let wat_owned: String = wat.to_string();
    let (tx, rx) = mpsc::channel::<(Vec<u8>, std::path::PathBuf)>();
    let tmp = tempdir().unwrap();
    let tmp_path = tmp.path().to_path_buf();
    let _join = thread::Builder::new()
        .stack_size(8 * 1024 * 1024)
        .spawn(move || {
            let bytes = WasmExecutor::compile_wat_to_wasm_bytes(&wat_owned).expect("wat compile");
            let file = tmp_path.join("demo.wasm");
            std::fs::write(&file, &bytes).unwrap();
            let _ = tx.send((bytes, file));
        })
        .unwrap();
    let (_bytes, file) = rx.recv().expect("thread send");

    let rt = WasmRuntime::new(tmp.path().to_path_buf());
    let outcome = rt
        .run_module_file("demo.wasm", None, Some(50_000), Some(5_000))
        .await
        .expect("run module file");
    assert_eq!(outcome.exit_code, 0);
    assert!(outcome.stdout.contains("\"result\":99"));
    let _ = file;
}
