use std::path::Path;

use super::AudioError;

#[cfg(any(feature = "voice", feature = "voice_stt"))]
use silero::{Session, SpeechOptions, SpeechSegmenter, StreamState};

pub struct VadDetector {
    threshold: f32,
    speaking: bool,

    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    session: Option<Session>,

    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    _options: Option<SpeechOptions>,

    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    stream: Option<StreamState>,

    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    segmenter: Option<SpeechSegmenter>,
}

impl VadDetector {
    pub fn new(_model_path: Option<&Path>, threshold: f32) -> Result<Self, AudioError> {
        #[cfg(any(feature = "voice", feature = "voice_stt"))]
        {
            if let Some(model_path) = _model_path {
                let session = Session::from_file(model_path)
                    .map_err(|err| AudioError::Other(err.to_string()))?;
                let options = SpeechOptions::default();
                let stream = StreamState::new(options.sample_rate());
                let segmenter = SpeechSegmenter::new(options.clone());
                return Ok(Self {
                    threshold,
                    speaking: false,
                    session: Some(session),
                    _options: Some(options),
                    stream: Some(stream),
                    segmenter: Some(segmenter),
                });
            }
        }

        Ok(Self {
            threshold,
            speaking: false,
            #[cfg(any(feature = "voice", feature = "voice_stt"))]
            session: None,
            #[cfg(any(feature = "voice", feature = "voice_stt"))]
            _options: None,
            #[cfg(any(feature = "voice", feature = "voice_stt"))]
            stream: None,
            #[cfg(any(feature = "voice", feature = "voice_stt"))]
            segmenter: None,
        })
    }

    pub fn push_samples(&mut self, chunk: &[f32]) -> Result<bool, AudioError> {
        #[cfg(any(feature = "voice", feature = "voice_stt"))]
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
