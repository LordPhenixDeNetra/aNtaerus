use engine_rust::audio::resampler::resample_linear_mono;

#[test]
fn resample_linear_returns_same_when_rates_equal() {
    let input = vec![0.0_f32, 1.0, 0.0, -1.0];
    let out = resample_linear_mono(&input, 16_000, 16_000);
    assert_eq!(out, input);
}

#[test]
fn resample_linear_changes_length() {
    let input = vec![0.0_f32; 160];
    let out = resample_linear_mono(&input, 8_000, 16_000);
    assert!(out.len() >= input.len() * 2 - 1);
}

