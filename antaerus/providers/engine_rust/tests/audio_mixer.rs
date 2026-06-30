use std::sync::Arc;

use engine_rust::audio::mixer::{Mixer, NullSink};

#[tokio::test]
async fn mixer_accepts_play_and_barge_in() {
    let mixer = Mixer::new(Arc::new(NullSink));
    mixer.play(16_000, vec![0.0_f32; 320]).await.unwrap();
    mixer.barge_in_stop().await.unwrap();
}

