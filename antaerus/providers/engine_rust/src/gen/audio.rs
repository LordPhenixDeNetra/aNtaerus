#[derive(Clone, PartialEq, ::prost::Message)]
pub struct StartVoiceSessionRequest {
    #[prost(string, tag = "1")]
    pub session_id: ::prost::alloc::string::String,
    #[prost(string, tag = "2")]
    pub language: ::prost::alloc::string::String,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct StopVoiceSessionRequest {
    #[prost(string, tag = "1")]
    pub session_id: ::prost::alloc::string::String,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct StopVoiceSessionResponse {
    #[prost(string, tag = "1")]
    pub session_id: ::prost::alloc::string::String,
    #[prost(bool, tag = "2")]
    pub stopped: bool,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct SpeakRequest {
    #[prost(string, tag = "1")]
    pub session_id: ::prost::alloc::string::String,
    #[prost(string, tag = "2")]
    pub text: ::prost::alloc::string::String,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct SpeakResponse {
    #[prost(string, tag = "1")]
    pub session_id: ::prost::alloc::string::String,
    #[prost(bool, tag = "2")]
    pub accepted: bool,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct VoiceEvent {
    #[prost(string, tag = "1")]
    pub session_id: ::prost::alloc::string::String,
    #[prost(oneof = "voice_event::Payload", tags = "2, 3, 4")]
    pub payload: ::core::option::Option<voice_event::Payload>,
}

pub mod voice_event {
    #[derive(Clone, PartialEq, ::prost::Oneof)]
    pub enum Payload {
        #[prost(message, tag = "2")]
        Vad(super::VadEvent),
        #[prost(message, tag = "3")]
        Transcript(super::TranscriptEvent),
        #[prost(message, tag = "4")]
        System(super::SystemEvent),
    }
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct VadEvent {
    #[prost(bool, tag = "1")]
    pub speaking: bool,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct TranscriptEvent {
    #[prost(string, tag = "1")]
    pub text: ::prost::alloc::string::String,
    #[prost(bool, tag = "2")]
    pub is_final: bool,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct SystemEvent {
    #[prost(string, tag = "1")]
    pub level: ::prost::alloc::string::String,
    #[prost(string, tag = "2")]
    pub message: ::prost::alloc::string::String,
}

pub mod audio_runtime_server {
    use std::sync::Arc;

    use tonic::codegen::{http, BoxFuture, Body, Service, StdError};

    use super::{
        SpeakRequest, SpeakResponse, StartVoiceSessionRequest, StopVoiceSessionRequest,
        StopVoiceSessionResponse, VoiceEvent,
    };

    #[tonic::async_trait]
    pub trait AudioRuntime: Send + Sync + 'static {
        type StartVoiceSessionStream: tonic::codegen::tokio_stream::Stream<
                Item = Result<VoiceEvent, tonic::Status>,
            > + Send
            + 'static;

        async fn start_voice_session(
            &self,
            request: tonic::Request<StartVoiceSessionRequest>,
        ) -> Result<tonic::Response<Self::StartVoiceSessionStream>, tonic::Status>;

        async fn stop_voice_session(
            &self,
            request: tonic::Request<StopVoiceSessionRequest>,
        ) -> Result<tonic::Response<StopVoiceSessionResponse>, tonic::Status>;

        async fn speak(
            &self,
            request: tonic::Request<SpeakRequest>,
        ) -> Result<tonic::Response<SpeakResponse>, tonic::Status>;
    }

    #[derive(Debug)]
    pub struct AudioRuntimeServer<T: AudioRuntime> {
        inner: Arc<T>,
        accept_compression_encodings: tonic::codec::EnabledCompressionEncodings,
        send_compression_encodings: tonic::codec::EnabledCompressionEncodings,
        max_decoding_message_size: Option<usize>,
        max_encoding_message_size: Option<usize>,
    }

    impl<T: AudioRuntime> AudioRuntimeServer<T> {
        pub fn new(inner: T) -> Self {
            Self {
                inner: Arc::new(inner),
                accept_compression_encodings: Default::default(),
                send_compression_encodings: Default::default(),
                max_decoding_message_size: None,
                max_encoding_message_size: None,
            }
        }
    }

    impl<T: AudioRuntime> Clone for AudioRuntimeServer<T> {
        fn clone(&self) -> Self {
            Self {
                inner: Arc::clone(&self.inner),
                accept_compression_encodings: self.accept_compression_encodings,
                send_compression_encodings: self.send_compression_encodings,
                max_decoding_message_size: self.max_decoding_message_size,
                max_encoding_message_size: self.max_encoding_message_size,
            }
        }
    }

    impl<T, B> Service<http::Request<B>> for AudioRuntimeServer<T>
    where
        T: AudioRuntime,
        B: Body + Send + 'static,
        B::Error: Into<StdError> + Send + 'static,
    {
        type Response = http::Response<tonic::body::BoxBody>;
        type Error = std::convert::Infallible;
        type Future = BoxFuture<Self::Response, Self::Error>;

        fn poll_ready(
            &mut self,
            _cx: &mut std::task::Context<'_>,
        ) -> std::task::Poll<Result<(), Self::Error>> {
            std::task::Poll::Ready(Ok(()))
        }

        fn call(&mut self, request: http::Request<B>) -> Self::Future {
            let inner = Arc::clone(&self.inner);
            let accept_compression_encodings = self.accept_compression_encodings;
            let send_compression_encodings = self.send_compression_encodings;
            let max_decoding_message_size = self.max_decoding_message_size;
            let max_encoding_message_size = self.max_encoding_message_size;

            match request.uri().path() {
                "/antaerus.kernel.audio.v1.AudioRuntime/StartVoiceSession" => {
                    struct StartVoiceSessionService<T: AudioRuntime>(Arc<T>);

                    impl<T: AudioRuntime> tonic::server::ServerStreamingService<StartVoiceSessionRequest>
                        for StartVoiceSessionService<T>
                    {
                        type Response = VoiceEvent;
                        type ResponseStream = T::StartVoiceSessionStream;
                        type Future =
                            BoxFuture<tonic::Response<Self::ResponseStream>, tonic::Status>;

                        fn call(
                            &mut self,
                            request: tonic::Request<StartVoiceSessionRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            Box::pin(async move { inner.start_voice_session(request).await })
                        }
                    }

                    Box::pin(async move {
                        let method = StartVoiceSessionService(inner);
                        let codec = tonic::codec::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        Ok(grpc.server_streaming(method, request).await)
                    })
                }
                "/antaerus.kernel.audio.v1.AudioRuntime/StopVoiceSession" => {
                    struct StopVoiceSessionService<T: AudioRuntime>(Arc<T>);

                    impl<T: AudioRuntime> tonic::server::UnaryService<StopVoiceSessionRequest>
                        for StopVoiceSessionService<T>
                    {
                        type Response = StopVoiceSessionResponse;
                        type Future = BoxFuture<tonic::Response<Self::Response>, tonic::Status>;

                        fn call(
                            &mut self,
                            request: tonic::Request<StopVoiceSessionRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            Box::pin(async move { inner.stop_voice_session(request).await })
                        }
                    }

                    Box::pin(async move {
                        let method = StopVoiceSessionService(inner);
                        let codec = tonic::codec::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        Ok(grpc.unary(method, request).await)
                    })
                }
                "/antaerus.kernel.audio.v1.AudioRuntime/Speak" => {
                    struct SpeakService<T: AudioRuntime>(Arc<T>);

                    impl<T: AudioRuntime> tonic::server::UnaryService<SpeakRequest>
                        for SpeakService<T>
                    {
                        type Response = SpeakResponse;
                        type Future = BoxFuture<tonic::Response<Self::Response>, tonic::Status>;

                        fn call(&mut self, request: tonic::Request<SpeakRequest>) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            Box::pin(async move { inner.speak(request).await })
                        }
                    }

                    Box::pin(async move {
                        let method = SpeakService(inner);
                        let codec = tonic::codec::ProstCodec::default();
                        let mut grpc = tonic::server::Grpc::new(codec)
                            .apply_compression_config(
                                accept_compression_encodings,
                                send_compression_encodings,
                            )
                            .apply_max_message_size_config(
                                max_decoding_message_size,
                                max_encoding_message_size,
                            );
                        Ok(grpc.unary(method, request).await)
                    })
                }
                _ => Box::pin(async move {
                    Ok(http::Response::builder()
                        .status(200)
                        .header("grpc-status", "12")
                        .header("content-type", "application/grpc")
                        .body(tonic::body::empty_body())
                        .expect("failed to build gRPC fallback response"))
                }),
            }
        }
    }

    impl<T: AudioRuntime> tonic::server::NamedService for AudioRuntimeServer<T> {
        const NAME: &'static str = "antaerus.kernel.audio.v1.AudioRuntime";
    }
}

