use crate::{config::Settings, grpc_service, http::build_router};
use std::path::PathBuf;

pub async fn run() {
    // ====== 0) CHARGER .env DU WORKSPACE antaerus/.env AVANT Settings::from_env(). ======
    //    CARGO_MANIFEST_DIR = .../antaerus/providers/engine_rust  → join("../..") → .../antaerus/ → join(".env")
    let dotenv_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.."))
        .join(".env");
    match dotenvy::from_path(&dotenv_path) {
        Ok(_) => println!("[OK] engine_rust loaded .env from: {}", dotenv_path.display()),
        Err(err) => {
            if err.not_found() {
                println!("[WARN] engine_rust: .env NOT FOUND at {} — using shell env vars only.", dotenv_path.display());
            } else {
                eprintln!("[ERROR] engine_rust: failed to parse .env at {} — {err:?}", dotenv_path.display());
            }
        }
    }
    // Toujours charger aussi un .env local providers/engine_rust/.env (SURCHARGE workspace antaerus/.env si meme variable)
    let dotenv_local = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".env");
    if dotenv_local.exists() {
        match dotenvy::from_path(&dotenv_local) {
            Ok(_) => println!("[OK] engine_rust LOCAL OVERLOAD: loaded {}", dotenv_local.display()),
            Err(err) => eprintln!("[ERROR] engine_rust LOCAL {err:?}"),
        }
    }
    println!();

    // ====== CRITICAL DIAGNOSTIC: afficher TOUS features compile-time en DEBUT DE PROCESS. ======
    // Plus jamais de doute "est-ce que j'ai lancé le bon binaire ???"
    let mut feat = Vec::<&'static str>::new();
    if cfg!(any(feature = "voice", feature = "voice_stt")) {
        feat.push("voice (STT micro→texte: cpal+silero+whisper)");
    }
    if cfg!(feature = "piper_tts") {
        feat.push("piper_tts (TTS texte→audio)");
    }
    if cfg!(feature = "wasm-runtime") {
        feat.push("wasm-runtime (WASM sandbox)");
    }
    if feat.is_empty() {
        feat.push("CORE seulement (PAS de voix, PAS de sandbox)");
    }
    println!();
    println!("╔══════════════════════════════════════════════════════════════════════╗");
    println!("║ aNtaerus Engine Rust - Features ACTIVEES ce build:                   ║");
    println!("║   {}{} ║", feat.join(", "), " ".repeat(std::cmp::max(0, 62usize.saturating_sub(feat.join(", ").len()))));
    println!("║                                                                      ║");
    println!("║ Rappel features:                                                     ║");
    println!("║   --features voice              = STT transcription micro (recommandé défaut)  ║");
    println!("║   --features \"voice,piper_tts\"  = STT + TTS synthese vocale (piper/ONNX) ║");
    println!("║   (sans feature)                = Mode CORE, pas d'audio            ║");
    println!("╚══════════════════════════════════════════════════════════════════════╝");
    println!();

    // ====== CRITICAL DIAGNOSTIC 2: afficher VRAIES valeurs ENV LUES (whisper/onnx/libclang) + settings ports ======
    let dbg_keys = [
        "ANTAERUS_ENGINE_WHISPER_MODEL_PATH",
        "ANTAERUS_ENGINE_VAD_MODEL_PATH",
        "ANTAERUS_ENGINE_PIPER_MODEL_PATH",
        "ANTAERUS_ENGINE_ONNX_RUNTIME_DIR",
        "ANTAERUS_ENGINE_LIBCLANG_PATH",
        "ANTAERUS_ENGINE_PORT",
        "ANTAERUS_ENGINE_GRPC_PORT",
    ];
    println!("[DIAG ENV VALUES engine_rust (lu depuis shell OU antaerus/.env)]:");
    for k in dbg_keys {
        match std::env::var(k) {
            Ok(v) if !v.is_empty() => println!("  {k} = {v}"),
            _ => println!("  {k} = <EMPTY / NON DEFINI>"),
        }
    }
    println!();

    let settings = Settings::from_env();
    let http_settings = settings.clone();
    let grpc_settings = settings.clone();

    tokio::try_join!(run_http(http_settings), grpc_service::run(grpc_settings))
        .expect("engine services failed");
}

async fn run_http(settings: Settings) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let address = format!("0.0.0.0:{}", settings.port);
    let listener = tokio::net::TcpListener::bind(address).await?;

    axum::serve(listener, build_router(settings)).await?;
    Ok(())
}
