use std::path::{Path, PathBuf};

use thiserror::Error;
#[cfg(feature = "wasm-runtime")]
use wasmtime::{Config, Engine, Instance, Linker, Module, Store};

use crate::config::Settings;
use crate::sandbox::executor::{RunOutcome, WasmExecutor, WasmExecutorConfig, WasmExecutorError};

#[cfg(feature = "wasm-runtime")]
const DEFAULT_WASM_FUEL: u64 = 10_000;

#[derive(Debug, Clone)]
pub struct WasmRuntime {
    #[cfg_attr(not(feature = "wasm-runtime"), allow(dead_code))]
    sandbox_root: PathBuf,
}

#[derive(Debug, Error)]
pub enum WasmRuntimeError {
    #[error("wasm runtime feature is not enabled")]
    RuntimeNotEnabled,
    #[error("wasm module not found: {0}")]
    ModuleNotFound(PathBuf),
    #[error("wasm module path not allowed: {0}")]
    ModulePathNotAllowed(PathBuf),
    #[cfg(feature = "wasm-runtime")]
    #[error("failed to build wasm engine: {0}")]
    Engine(#[source] wasmtime::Error),
    #[cfg(feature = "wasm-runtime")]
    #[error("failed to load wasm module {path}: {source}")]
    LoadModule {
        path: PathBuf,
        #[source]
        source: wasmtime::Error,
    },
    #[cfg(feature = "wasm-runtime")]
    #[error("failed to add fuel to wasm store: {0}")]
    Fuel(#[source] wasmtime::Error),
    #[cfg(feature = "wasm-runtime")]
    #[error("failed to instantiate wasm module: {0}")]
    Instantiate(#[source] wasmtime::Error),
    #[cfg(feature = "wasm-runtime")]
    #[error("failed to lookup export {export}: {source}")]
    ExportLookup {
        export: String,
        #[source]
        source: wasmtime::Error,
    },
    #[cfg(feature = "wasm-runtime")]
    #[error("failed to call export {export}: {source}")]
    Call {
        export: String,
        #[source]
        source: wasmtime::Error,
    },
}

impl WasmRuntime {
    pub fn from_settings(settings: &Settings) -> Self {
        Self {
            sandbox_root: settings.tools_sandbox_root.clone(),
        }
    }

    pub fn new(sandbox_root: PathBuf) -> Self {
        Self { sandbox_root }
    }

    pub fn execute_i32_export(
        &self,
        module_path: impl AsRef<Path>,
        export_name: &str,
    ) -> Result<i32, WasmRuntimeError> {
        #[cfg(not(feature = "wasm-runtime"))]
        {
            let _ = module_path;
            let _ = export_name;
            Err(WasmRuntimeError::RuntimeNotEnabled)
        }

        #[cfg(feature = "wasm-runtime")]
        {
        let resolved = self.resolve_module_path(module_path)?;

        let mut config = Config::new();
        config.consume_fuel(true);
        let engine = Engine::new(&config).map_err(WasmRuntimeError::Engine)?;
        let module = Module::from_file(&engine, resolved.as_path()).map_err(|source| {
            WasmRuntimeError::LoadModule {
                path: resolved.clone(),
                source,
            }
        })?;

        let mut store = Store::new(&engine, ());
        store
            .set_fuel(DEFAULT_WASM_FUEL)
            .map_err(WasmRuntimeError::Fuel)?;
        let linker = Linker::new(&engine);
        let instance = linker
            .instantiate(&mut store, &module)
            .map_err(WasmRuntimeError::Instantiate)?;
        call_i32_export(&mut store, &instance, export_name)
        }
    }

    #[cfg_attr(not(feature = "wasm-runtime"), allow(dead_code))]
    fn resolve_module_path(
        &self,
        module_path: impl AsRef<Path>,
    ) -> Result<PathBuf, WasmRuntimeError> {
        let module_path = module_path.as_ref();
        let absolute_path = if module_path.is_absolute() {
            module_path.to_path_buf()
        } else {
            self.sandbox_root.join(module_path)
        };
        if !absolute_path.exists() || !absolute_path.is_file() {
            return Err(WasmRuntimeError::ModuleNotFound(absolute_path));
        }

        let resolved = absolute_path
            .canonicalize()
            .unwrap_or_else(|_| absolute_path.clone());
        let sandbox_root = self
            .sandbox_root
            .canonicalize()
            .unwrap_or_else(|_| self.sandbox_root.clone());
        if !resolved.starts_with(sandbox_root.as_path()) {
            return Err(WasmRuntimeError::ModulePathNotAllowed(resolved));
        }
        Ok(resolved)
    }

    pub fn compile_wat_to_wasm_bytes(wat: &str) -> Result<Vec<u8>, WasmExecutorError> {
        WasmExecutor::compile_wat_to_wasm_bytes(wat)
    }

    pub async fn run_module_bytes(
        &self,
        module_bytes: &[u8],
        arg: Option<i32>,
        fuel_limit: Option<u64>,
        timeout_ms: Option<u64>,
    ) -> Result<RunOutcome, WasmExecutorError> {
        use std::time::Duration;
        let mut config = WasmExecutorConfig::default();
        if let Some(f) = fuel_limit {
            config.fuel_limit = f;
        }
        if let Some(ms) = timeout_ms {
            config.timeout = Duration::from_millis(ms);
        }
        let executor = WasmExecutor::new(config);
        executor.run_i32_bytes(module_bytes, arg).await
    }

    pub async fn run_module_file(
        &self,
        module_path: impl AsRef<Path>,
        arg: Option<i32>,
        fuel_limit: Option<u64>,
        timeout_ms: Option<u64>,
    ) -> Result<RunOutcome, WasmRuntimeError> {
        #[cfg(not(feature = "wasm-runtime"))]
        {
            let _ = module_path;
            let _ = arg;
            let _ = fuel_limit;
            let _ = timeout_ms;
            Err(WasmRuntimeError::RuntimeNotEnabled)
        }

        #[cfg(feature = "wasm-runtime")]
        {
            let resolved = self.resolve_module_path(module_path)?;
            let bytes = std::fs::read(resolved.as_path()).map_err(|e| {
                WasmRuntimeError::LoadModule {
                    path: resolved.clone(),
                    source: wasmtime::Error::msg(e.to_string()),
                }
            })?;
            self.run_module_bytes(&bytes, arg, fuel_limit, timeout_ms)
                .await
                .map_err(|e| match e {
                    WasmExecutorError::RuntimeNotEnabled => WasmRuntimeError::RuntimeNotEnabled,
                    WasmExecutorError::EmptyModule => WasmRuntimeError::LoadModule {
                        path: resolved.clone(),
                        source: wasmtime::Error::msg("empty wasm module"),
                    },
                    WasmExecutorError::Engine(e) => WasmRuntimeError::Engine(e),
                    WasmExecutorError::CompileModule(e) => WasmRuntimeError::LoadModule {
                        path: resolved.clone(),
                        source: e,
                    },
                    WasmExecutorError::Fuel(e) => WasmRuntimeError::Fuel(e),
                    WasmExecutorError::Instantiate(e) => WasmRuntimeError::Instantiate(e),
                    WasmExecutorError::ExportLookup { export, source } => {
                        WasmRuntimeError::ExportLookup { export, source }
                    }
                    WasmExecutorError::Call { export, source } => WasmRuntimeError::Call {
                        export,
                        source,
                    },
                    other => WasmRuntimeError::Call {
                        export: "run".into(),
                        source: wasmtime::Error::msg(other.to_string()),
                    },
                })
        }
    }
}

#[cfg(feature = "wasm-runtime")]
fn call_i32_export(
    store: &mut Store<()>,
    instance: &Instance,
    export_name: &str,
) -> Result<i32, WasmRuntimeError> {
    let func = instance
        .get_typed_func::<(), i32>(&mut *store, export_name)
        .map_err(|source| WasmRuntimeError::ExportLookup {
            export: export_name.to_string(),
            source,
        })?;
    func.call(&mut *store, ())
        .map_err(|source| WasmRuntimeError::Call {
            export: export_name.to_string(),
            source,
        })
}
