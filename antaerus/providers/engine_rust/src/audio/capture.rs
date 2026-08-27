use tokio::sync::mpsc;

use super::AudioError;

pub type PcmStreamReceiver = mpsc::Receiver<Vec<f32>>;

pub struct CaptureHandle {
    receiver: Option<PcmStreamReceiver>,
    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    _stream: cpal::Stream,
}

impl CaptureHandle {
    pub fn take_receiver(&mut self) -> PcmStreamReceiver {
        self.receiver
            .take()
            .expect("take_receiver() called multiple times on CaptureHandle; receiver is a one-shot tokio mpsc::Receiver")
    }
}

pub fn start_microphone_capture() -> Result<CaptureHandle, AudioError> {
    #[cfg(any(feature = "voice", feature = "voice_stt"))]
    {
        use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
        use cpal::{Device, Sample, SampleFormat, StreamConfig};
        use num_traits::cast::ToPrimitive;

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
                        out.extend(data.iter().filter_map(ToPrimitive::to_f32));
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
                        out.extend(data.iter().filter_map(ToPrimitive::to_f32));
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
            receiver: Some(receiver),
            _stream: stream,
        })
    }

    #[cfg(not(any(feature = "voice", feature = "voice_stt")))]
    {
        Err(AudioError::VoiceFeatureDisabled)
    }
}
