pub fn resample_linear_mono(samples: &[f32], input_hz: u32, output_hz: u32) -> Vec<f32> {
    if samples.is_empty() {
        return vec![];
    }

    if input_hz == 0 || output_hz == 0 || input_hz == output_hz {
        return samples.to_vec();
    }

    let ratio = output_hz as f64 / input_hz as f64;
    let out_len = ((samples.len() as f64) * ratio).ceil().max(1.0) as usize;
    let mut out = Vec::with_capacity(out_len);

    for i in 0..out_len {
        let src_pos = (i as f64) / ratio;
        let idx0 = src_pos.floor() as usize;
        let idx1 = idx0.saturating_add(1).min(samples.len() - 1);
        let frac = (src_pos - idx0 as f64) as f32;
        let v0 = samples[idx0];
        let v1 = samples[idx1];
        out.push(v0 + (v1 - v0) * frac);
    }

    out
}

