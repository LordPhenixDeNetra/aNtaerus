use std::path::Path;

use super::AudioError;

#[cfg(feature = "voice")]
use silero::{Session, SpeechOptions, SpeechSegmenter, StreamState};

pub struct VadDetector {
    threshold: f32,
    speaking: bool,

    #[cfg(feature = "voice")]
    session: Option<Session>,

    #[cfg(feature = "voice")]
    options: Option<SpeechOptions>,

    #[cfg(feature = "voice")]
    stream: Option<StreamState>,

    #[cfg(feature = "voice")]
    segmenter: Option<SpeechSegmenter>,
}

impl VadDetector {
    pub fn new(model_path: Option<&Path>, threshold: f32) -> Result<Self, AudioError> {
        #[cfg(feature = "voice")]
        {
            if let Some(model_path) = model_path {
                let session = Session::from_file(model_path)
                    .map_err(|err| AudioError::Other(err.to_string()))?;
                let options = SpeechOptions::default();
                let stream = StreamState::new(options.sample_rate());
                let segmenter = SpeechSegmenter::new(options.clone());
                return Ok(Self {
                    threshold,
                    speaking: false,
                    session: Some(session),
                    options: Some(options),
                    stream: Some(stream),
                    segmenter: Some(segmenter),
                });
            }
        }

        Ok(Self {
            threshold,
            speaking: false,
            #[cfg(feature = "voice")]
            session: None,
            #[cfg(feature = "voice")]
            options: None,
            #[cfg(feature = "voice")]
            stream: None,
            #[cfg(feature = "voice")]
            segmenter: None,
        })
    }

    pub fn push_samples(&mut self, chunk: &[f32]) -> Result<bool, AudioError> {
        #[cfg(feature = "voice")]
        {
            if self.session.is_some() {
                let session = self.session.as_mut().unwrap();
                let stream = self.stream.as_mut().unwrap();
                let segmenter = self.segmenter.as_mut().unwrap();

                if segmenter
                    .push_samples(session, stream, chunk)
                    .map_err(|err| AudioError::Other(err.to_string()))?
                    .is_some()
                {
                    self.speaking = true;
                    return Ok(true);
                }

                if self.speaking
                    && segmenter
                        .push_samples(session, stream, &[])
                        .map_err(|err| AudioError::Other(err.to_string()))?
                        .is_some()
                {
                    self.speaking = false;
                }

                return Ok(self.speaking);
            }
        }

        let rms = rms_energy(chunk);
        let next = if self.speaking {
            rms > self.threshold * 0.5
        } else {
            rms > self.threshold
        };
        self.speaking = next;
        Ok(self.speaking)
    }
}

fn rms_energy(chunk: &[f32]) -> f32 {
    if chunk.is_empty() {
        return 0.0;
    }

    let sum = chunk.iter().map(|v| v * v).sum::<f32>();
    (sum / chunk.len() as f32).sqrt()
}

