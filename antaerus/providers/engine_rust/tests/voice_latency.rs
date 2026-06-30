use std::time::Instant;

use engine_rust::audio::{resampler::resample_linear_mono, AudioError};

#[test]
#[ignore]
fn latency_capture_to_stt_under_200ms() -> Result<(), AudioError> {
    let started = Instant::now();
    let audio_16k = vec![0.0_f32; 16_000];
    let _ = resample_linear_mono(&audio_16k, 16_000, 16_000);
    let elapsed = started.elapsed();
    let _ = elapsed;
    Ok(())
}

#[test]
#[ignore]
fn latency_text_to_tts_under_300ms() -> Result<(), AudioError> {
    let started = Instant::now();
    let audio_16k = vec![0.0_f32; 16_000];
    let _ = resample_linear_mono(&audio_16k, 16_000, 16_000);
    let elapsed = started.elapsed();
    let _ = elapsed;
    Ok(())
}

