use tokio::sync::mpsc;

use super::AudioError;

pub type PcmStreamReceiver = mpsc::Receiver<Vec<f32>>;

pub struct CaptureHandle {
    receiver: PcmStreamReceiver,
    #[cfg(feature = "voice")]
    _stream: cpal::Stream,
}

impl CaptureHandle {
    pub fn receiver(self) -> PcmStreamReceiver {
        self.receiver
    }
}

pub fn start_microphone_capture() -> Result<CaptureHandle, AudioError> {
    #[cfg(feature = "voice")]
    {
        use cpal::{Device, HostTrait, Sample, SampleFormat, StreamConfig};

        let (sender, receiver) = mpsc::channel::<Vec<f32>>(8);
        let host = cpal::default_host();
        let device: Device = host
            .default_input_device()
            .ok_or(AudioError::Other("No default input device".to_string()))?;
        let supported = device
            .default_input_config()
            .map_err(|err| AudioError::Other(err.to_string()))?;
        let sample_format = supported.sample_format();
        let config: StreamConfig = supported.into();

        let err_fn = move |err| {
            let _ = err;
        };

        let stream = match sample_format {
            SampleFormat::F32 => device
                .build_input_stream(
                    &config,
                    move |data: &[f32], _| {
                        let _ = sender.try_send(data.to_vec());
                    },
                    err_fn,
                    None,
                )
                .map_err(|err| AudioError::Other(err.to_string()))?,
            SampleFormat::I16 => device
                .build_input_stream(
                    &config,
                    move |data: &[i16], _| {
                        let mut out = Vec::with_capacity(data.len());
                        out.extend(data.iter().map(|value| value.to_f32()));
                        let _ = sender.try_send(out);
                    },
                    err_fn,
                    None,
                )
                .map_err(|err| AudioError::Other(err.to_string()))?,
            SampleFormat::U16 => device
                .build_input_stream(
                    &config,
                    move |data: &[u16], _| {
                        let mut out = Vec::with_capacity(data.len());
                        out.extend(data.iter().map(|value| value.to_f32()));
                        let _ = sender.try_send(out);
                    },
                    err_fn,
                    None,
                )
                .map_err(|err| AudioError::Other(err.to_string()))?,
            _ => return Err(AudioError::Unsupported("Unsupported sample format")),
        };

        stream
            .play()
            .map_err(|err| AudioError::Other(err.to_string()))?;

        Ok(CaptureHandle {
            receiver,
            _stream: stream,
        })
    }

    #[cfg(not(feature = "voice"))]
    {
        Err(AudioError::VoiceFeatureDisabled)
    }
}
