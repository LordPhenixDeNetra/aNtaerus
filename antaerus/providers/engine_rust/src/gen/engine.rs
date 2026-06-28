#[derive(Clone, PartialEq, ::prost::Message)]
pub struct PingRequest {
    #[prost(string, tag = "1")]
    pub request_id: ::prost::alloc::string::String,
    #[prost(int64, tag = "2")]
    pub sent_at_unix_nano: i64,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct PingResponse {
    #[prost(string, tag = "1")]
    pub request_id: ::prost::alloc::string::String,
    #[prost(int64, tag = "2")]
    pub sent_at_unix_nano: i64,
    #[prost(int64, tag = "3")]
    pub received_at_unix_nano: i64,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct HealthRequest {}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct HealthResponse {
    #[prost(string, tag = "1")]
    pub name: ::prost::alloc::string::String,
    #[prost(string, tag = "2")]
    pub status: ::prost::alloc::string::String,
    #[prost(string, tag = "3")]
    pub version: ::prost::alloc::string::String,
    #[prost(uint32, tag = "4")]
    pub port: u32,
    #[prost(string, tag = "5")]
    pub url: ::prost::alloc::string::String,
    #[prost(string, tag = "6")]
    pub checked_at: ::prost::alloc::string::String,
    #[prost(string, tag = "7")]
    pub details: ::prost::alloc::string::String,
}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct CapabilitiesRequest {}

#[derive(Clone, PartialEq, ::prost::Message)]
pub struct CapabilitiesResponse {
    #[prost(string, tag = "1")]
    pub name: ::prost::alloc::string::String,
    #[prost(string, tag = "2")]
    pub version: ::prost::alloc::string::String,
    #[prost(string, tag = "3")]
    pub runtime: ::prost::alloc::string::String,
    #[prost(string, repeated, tag = "4")]
    pub capabilities: ::prost::alloc::vec::Vec<::prost::alloc::string::String>,
}

pub mod engine_runtime_server {
    use std::sync::Arc;

    use tonic::codegen::{http, Body, BoxFuture, Service, StdError};

    use super::{
        CapabilitiesRequest, CapabilitiesResponse, HealthRequest, HealthResponse, PingRequest,
        PingResponse,
    };

    #[tonic::async_trait]
    pub trait EngineRuntime: Send + Sync + 'static {
        async fn ping(
            &self,
            request: tonic::Request<PingRequest>,
        ) -> Result<tonic::Response<PingResponse>, tonic::Status>;

        async fn get_health(
            &self,
            request: tonic::Request<HealthRequest>,
        ) -> Result<tonic::Response<HealthResponse>, tonic::Status>;

        async fn get_capabilities(
            &self,
            request: tonic::Request<CapabilitiesRequest>,
        ) -> Result<tonic::Response<CapabilitiesResponse>, tonic::Status>;
    }

    #[derive(Debug)]
    pub struct EngineRuntimeServer<T: EngineRuntime> {
        inner: Arc<T>,
        accept_compression_encodings: tonic::codec::EnabledCompressionEncodings,
        send_compression_encodings: tonic::codec::EnabledCompressionEncodings,
        max_decoding_message_size: Option<usize>,
        max_encoding_message_size: Option<usize>,
    }

    impl<T: EngineRuntime> EngineRuntimeServer<T> {
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

    impl<T: EngineRuntime> Clone for EngineRuntimeServer<T> {
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

    impl<T, B> Service<http::Request<B>> for EngineRuntimeServer<T>
    where
        T: EngineRuntime,
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
                "/antaerus.kernel.engine.v1.EngineRuntime/Ping" => {
                    struct PingService<T: EngineRuntime>(Arc<T>);

                    impl<T: EngineRuntime> tonic::server::UnaryService<PingRequest> for PingService<T> {
                        type Response = PingResponse;
                        type Future = BoxFuture<tonic::Response<Self::Response>, tonic::Status>;

                        fn call(&mut self, request: tonic::Request<PingRequest>) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            Box::pin(async move { inner.ping(request).await })
                        }
                    }

                    Box::pin(async move {
                        let method = PingService(inner);
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
                "/antaerus.kernel.engine.v1.EngineRuntime/GetHealth" => {
                    struct GetHealthService<T: EngineRuntime>(Arc<T>);

                    impl<T: EngineRuntime> tonic::server::UnaryService<HealthRequest> for GetHealthService<T> {
                        type Response = HealthResponse;
                        type Future = BoxFuture<tonic::Response<Self::Response>, tonic::Status>;

                        fn call(&mut self, request: tonic::Request<HealthRequest>) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            Box::pin(async move { inner.get_health(request).await })
                        }
                    }

                    Box::pin(async move {
                        let method = GetHealthService(inner);
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
                "/antaerus.kernel.engine.v1.EngineRuntime/GetCapabilities" => {
                    struct GetCapabilitiesService<T: EngineRuntime>(Arc<T>);

                    impl<T: EngineRuntime> tonic::server::UnaryService<CapabilitiesRequest>
                        for GetCapabilitiesService<T>
                    {
                        type Response = CapabilitiesResponse;
                        type Future = BoxFuture<tonic::Response<Self::Response>, tonic::Status>;

                        fn call(
                            &mut self,
                            request: tonic::Request<CapabilitiesRequest>,
                        ) -> Self::Future {
                            let inner = Arc::clone(&self.0);
                            Box::pin(async move { inner.get_capabilities(request).await })
                        }
                    }

                    Box::pin(async move {
                        let method = GetCapabilitiesService(inner);
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

    impl<T: EngineRuntime> tonic::server::NamedService for EngineRuntimeServer<T> {
        const NAME: &'static str = "antaerus.kernel.engine.v1.EngineRuntime";
    }
}
