use serde::{Deserialize, Serialize};
use thiserror::Error;

#[cfg(any(test, feature = "wat-compile"))]
use wat::parse_str as wat_parse_str;

#[cfg(feature = "wasm-runtime")]
use {
    std::time::{Duration, Instant},
    tokio::time::timeout,
    wasmtime::{Config, Engine, Instance, Linker, Module, Store},
};

pub const DEFAULT_FUEL: u64 = 250_000;
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunOutcome {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub fuel_used: u64,
    pub duration_ms: u64,
}

impl Default for RunOutcome {
    fn default() -> Self {
        Self {
            exit_code: 0,
            stdout: String::new(),
            stderr: String::new(),
            fuel_used: 0,
            duration_ms: 0,
        }
    }
}

#[derive(Debug, Error)]
pub enum WasmExecutorError {
    #[error("wasm runtime feature is not enabled")]
    RuntimeNotEnabled,

    #[error("empty wasm module bytes")]
    EmptyModule,

    #[error("wat parsing is only available with wat enabled (dev/test builds)")]
    WatCompileNotAvailable,

    #[error("invalid wat source: {0}")]
    WatParse(String),

    #[cfg(feature = "wasm-runtime")]
    #[error("failed to build wasm engine: {0}")]
    Engine(#[source] wasmtime::Error),

    #[cfg(feature = "wasm-runtime")]
    #[error("failed to compile wasm module: {0}")]
    CompileModule(#[source] wasmtime::Error),

    #[cfg(feature = "wasm-runtime")]
    #[error("failed to set fuel in wasm store: {0}")]
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
    #[error("wasm export {export} failed during call: {source}")]
    Call {
        export: String,
        #[source]
        source: wasmtime::Error,
    },

    #[error("execution timed out after {ms}ms")]
    Timeout { ms: u64 },

    #[error("out of fuel after consuming {used}/{limit} units")]
    OutOfFuel { used: u64, limit: u64 },
}

#[derive(Debug, Clone)]
pub struct WasmExecutorConfig {
    pub fuel_limit: u64,
    pub timeout: Duration,
    pub export_name: String,
}

impl Default for WasmExecutorConfig {
    fn default() -> Self {
        Self {
            fuel_limit: DEFAULT_FUEL,
            timeout: DEFAULT_TIMEOUT,
            export_name: "run".to_string(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct WasmExecutor {
    config: WasmExecutorConfig,
}

impl WasmExecutor {
    pub fn new(config: WasmExecutorConfig) -> Self {
        Self { config }
    }

    pub fn with_defaults() -> Self {
        Self::new(WasmExecutorConfig::default())
    }

    pub fn config(&self) -> &WasmExecutorConfig {
        &self.config
    }

    pub fn compile_wat_to_wasm_bytes(wat_source: &str) -> Result<Vec<u8>, WasmExecutorError> {
        #[cfg(any(test, feature = "wat-compile"))]
        {
            wat_parse_str(wat_source).map_err(|e| WasmExecutorError::WatParse(e.to_string()))
        }
        #[cfg(not(any(test, feature = "wat-compile")))]
        {
            let _ = wat_source;
            Err(WasmExecutorError::WatCompileNotAvailable)
        }
    }

    pub async fn run_i32_bytes(
        &self,
        module_bytes: &[u8],
        arg: Option<i32>,
    ) -> Result<RunOutcome, WasmExecutorError> {
        #[cfg(not(feature = "wasm-runtime"))]
        {
            let _ = module_bytes;
            let _ = arg;
            Err(WasmExecutorError::RuntimeNotEnabled)
        }

        #[cfg(feature = "wasm-runtime")]
        {
            if module_bytes.is_empty() {
                return Err(WasmExecutorError::EmptyModule);
            }
            let started = Instant::now();
            let export = self.config.export_name.clone();
            let fuel_limit = self.config.fuel_limit;
            let timeout_limit = self.config.timeout;

            let engine = build_engine()?;
            let module_bytes_owned: Vec<u8> = module_bytes.to_vec();
            let owned_arg = arg.unwrap_or(0);
            let export_clone = export.clone();

            let task = async move {
                let engine_clone = engine.clone();
                let export_inner = export_clone.clone();
                tokio::task::spawn_blocking(move || -> (Result<i32, WasmExecutorError>, u64) {
                    let module = match Module::from_binary(&engine_clone, &module_bytes_owned) {
                        Ok(m) => m,
                        Err(e) => return (Err(WasmExecutorError::CompileModule(e)), fuel_limit),
                    };
                    let mut store = Store::new(&engine_clone, ());
                    if let Err(e) = store.set_fuel(fuel_limit) {
                        return (Err(WasmExecutorError::Fuel(e)), fuel_limit);
                    }
                    let linker = Linker::new(&engine_clone);
                    let instance = match linker.instantiate(&mut store, &module) {
                        Ok(i) => i,
                        Err(e) => {
                            let rem = store.get_fuel().unwrap_or(0);
                            return (Err(WasmExecutorError::Instantiate(e)), rem);
                        }
                    };
                    match call_i32_export_inner(&mut store, &instance, &export_inner, owned_arg) {
                        Ok((value, rem)) => (Ok(value), rem),
                        Err((e, rem)) => (Err(e), rem),
                    }
                })
                .await
                .unwrap_or_else(|join_err| {
                    (
                        Err(WasmExecutorError::Call {
                            export: export_clone.clone(),
                            source: wasmtime::Error::msg(join_err.to_string()),
                        }),
                        fuel_limit,
                    )
                })
            };

            let timeout_ms = timeout_limit.as_millis() as u64;
            let (call_result, remaining_fuel) = match timeout(timeout_limit, task).await {
                Ok(v) => v,
                Err(_) => {
                    return Err(WasmExecutorError::Timeout { ms: timeout_ms });
                }
            };

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
                        duration_ms: started.elapsed().as_millis() as u64,
                    })
                }
                Err(WasmExecutorError::Call { export, source }) => {
                    let msg = source.to_string();
                    if msg.contains("fuel") || msg.contains("Fuel") || msg.contains("trap") {
                        if fuel_used >= fuel_limit.saturating_sub(1) {
                            return Err(WasmExecutorError::OutOfFuel {
                                used: fuel_used,
                                limit: fuel_limit,
                            });
                        }
                    }
                    Err(WasmExecutorError::Call {
                        export,
                        source,
                    })
                }
                Err(other) => Err(other),
            }
        }
    }
}

#[cfg(feature = "wasm-runtime")]
pub fn build_engine() -> Result<Engine, WasmExecutorError> {
    let mut config = Config::new();
    config.consume_fuel(true);
    Engine::new(&config).map_err(WasmExecutorError::Engine)
}

#[cfg(feature = "wasm-runtime")]
pub fn call_i32_export_inner(
    store: &mut Store<()>,
    instance: &Instance,
    export_name: &str,
    arg: i32,
) -> Result<(i32, u64), (WasmExecutorError, u64)> {
    let export = match instance.get_export(&mut *store, export_name) {
        Some(e) => e,
        None => {
            let rem = store.get_fuel().unwrap_or(0);
            return Err((
                WasmExecutorError::ExportLookup {
                    export: export_name.to_string(),
                    source: wasmtime::Error::msg("export not found"),
                },
                rem,
            ));
        }
    };
    let func = match export.into_func() {
        Some(f) => f,
        None => {
            let rem = store.get_fuel().unwrap_or(0);
            return Err((
                WasmExecutorError::ExportLookup {
                    export: export_name.to_string(),
                    source: wasmtime::Error::msg("export is not a func"),
                },
                rem,
            ));
        }
    };
    let ty = func.ty(&*store);
    let params: Vec<_> = ty.params().collect();

    let result = if matches!(params.as_slice(), [wasmtime::ValType::I32]) {
        let typed = match instance.get_typed_func::<i32, i32>(&mut *store, export_name) {
            Ok(f) => f,
            Err(source) => {
                let rem = store.get_fuel().unwrap_or(0);
                return Err((
                    WasmExecutorError::ExportLookup {
                        export: export_name.to_string(),
                        source,
                    },
                    rem,
                ));
            }
        };
        typed.call(&mut *store, arg)
    } else {
        let typed = match instance.get_typed_func::<(), i32>(&mut *store, export_name) {
            Ok(f) => f,
            Err(source) => {
                let rem = store.get_fuel().unwrap_or(0);
                return Err((
                    WasmExecutorError::ExportLookup {
                        export: export_name.to_string(),
                        source,
                    },
                    rem,
                ));
            }
        };
        typed.call(&mut *store, ())
    };

    let remaining = store.get_fuel().unwrap_or(0);
    match result {
        Ok(v) => Ok((v, remaining)),
        Err(source) => Err((
            WasmExecutorError::Call {
                export: export_name.to_string(),
                source,
            },
            remaining,
        )),
    }
}
