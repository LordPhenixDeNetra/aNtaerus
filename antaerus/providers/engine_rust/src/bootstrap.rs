use crate::{config::Settings, grpc_service, http::build_router};

pub async fn run() {
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
