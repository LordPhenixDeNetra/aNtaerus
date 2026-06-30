use std::sync::atomic::{AtomicU64, Ordering};

use tokio::sync::mpsc;

use super::AudioError;

#[derive(Clone)]
pub struct Mixer {
    sender: mpsc::Sender<MixerCommand>,
    generation: std::sync::Arc<AtomicU64>,
}

enum MixerCommand {
    Play {
        generation: u64,
        sample_rate: u32,
        samples: Vec<f32>,
    },
    StopAll {
        generation: u64,
    },
}

pub trait AudioSink: Send + Sync + 'static {
    fn play(&self, sample_rate: u32, samples: Vec<f32>);
    fn stop(&self);
}

pub struct NullSink;

impl AudioSink for NullSink {
    fn play(&self, _sample_rate: u32, _samples: Vec<f32>) {}

    fn stop(&self) {}
}

impl Mixer {
    pub fn new(sink: std::sync::Arc<dyn AudioSink>) -> Self {
        let (sender, mut receiver) = mpsc::channel::<MixerCommand>(32);
        let generation = std::sync::Arc::new(AtomicU64::new(0));
        let generation_task = generation.clone();

        tokio::spawn(async move {
            while let Some(command) = receiver.recv().await {
                match command {
                    MixerCommand::Play {
                        generation,
                        sample_rate,
                        samples,
                    } => {
                        if generation_task.load(Ordering::Relaxed) == generation {
                            sink.play(sample_rate, samples);
                        }
                    }
                    MixerCommand::StopAll { generation } => {
                        generation_task.store(generation, Ordering::Relaxed);
                        sink.stop();
                    }
                }
            }
        });

        Self { sender, generation }
    }

    pub async fn play(&self, sample_rate: u32, samples: Vec<f32>) -> Result<(), AudioError> {
        let generation = self.generation.load(Ordering::Relaxed);
        self.sender
            .send(MixerCommand::Play {
                generation,
                sample_rate,
                samples,
            })
            .await
            .map_err(|_| AudioError::Other("Mixer command channel closed".to_string()))?;
        Ok(())
    }

    pub async fn barge_in_stop(&self) -> Result<(), AudioError> {
        let generation = self.generation.fetch_add(1, Ordering::Relaxed) + 1;
        self.sender
            .send(MixerCommand::StopAll { generation })
            .await
            .map_err(|_| AudioError::Other("Mixer command channel closed".to_string()))?;
        Ok(())
    }
}

