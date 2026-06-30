// Code generated manually to mirror protoc-gen-go-grpc output in the sandbox. DO NOT EDIT.
// source: audio.proto

package audiopb

import (
	context "context"

	grpc "google.golang.org/grpc"
)

const _ = grpc.SupportPackageIsVersion9

const (
	AudioRuntime_StartVoiceSession_FullMethodName = "/antaerus.kernel.audio.v1.AudioRuntime/StartVoiceSession"
	AudioRuntime_StopVoiceSession_FullMethodName  = "/antaerus.kernel.audio.v1.AudioRuntime/StopVoiceSession"
	AudioRuntime_Speak_FullMethodName             = "/antaerus.kernel.audio.v1.AudioRuntime/Speak"
)

type AudioRuntimeClient interface {
	StartVoiceSession(ctx context.Context, in *StartVoiceSessionRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[VoiceEvent], error)
	StopVoiceSession(ctx context.Context, in *StopVoiceSessionRequest, opts ...grpc.CallOption) (*StopVoiceSessionResponse, error)
	Speak(ctx context.Context, in *SpeakRequest, opts ...grpc.CallOption) (*SpeakResponse, error)
}

type audioRuntimeClient struct {
	cc grpc.ClientConnInterface
}

func NewAudioRuntimeClient(cc grpc.ClientConnInterface) AudioRuntimeClient {
	return &audioRuntimeClient{cc: cc}
}

func (c *audioRuntimeClient) StartVoiceSession(ctx context.Context, in *StartVoiceSessionRequest, opts ...grpc.CallOption) (grpc.ServerStreamingClient[VoiceEvent], error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	stream, err := c.cc.NewStream(ctx, &AudioRuntime_ServiceDesc.Streams[0], AudioRuntime_StartVoiceSession_FullMethodName, cOpts...)
	if err != nil {
		return nil, err
	}

	clientStream := &grpc.GenericClientStream[StartVoiceSessionRequest, VoiceEvent]{ClientStream: stream}
	if err := clientStream.Send(in); err != nil {
		return nil, err
	}
	if err := clientStream.CloseSend(); err != nil {
		return nil, err
	}

	return clientStream, nil
}

func (c *audioRuntimeClient) StopVoiceSession(ctx context.Context, in *StopVoiceSessionRequest, opts ...grpc.CallOption) (*StopVoiceSessionResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(StopVoiceSessionResponse)
	if err := c.cc.Invoke(ctx, AudioRuntime_StopVoiceSession_FullMethodName, in, out, cOpts...); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *audioRuntimeClient) Speak(ctx context.Context, in *SpeakRequest, opts ...grpc.CallOption) (*SpeakResponse, error) {
	cOpts := append([]grpc.CallOption{grpc.StaticMethod()}, opts...)
	out := new(SpeakResponse)
	if err := c.cc.Invoke(ctx, AudioRuntime_Speak_FullMethodName, in, out, cOpts...); err != nil {
		return nil, err
	}
	return out, nil
}

var AudioRuntime_ServiceDesc = grpc.ServiceDesc{
	ServiceName: "antaerus.kernel.audio.v1.AudioRuntime",
	HandlerType: (*any)(nil),
	Methods: []grpc.MethodDesc{
		{
			MethodName: "StopVoiceSession",
		},
		{
			MethodName: "Speak",
		},
	},
	Streams: []grpc.StreamDesc{
		{
			StreamName:    "StartVoiceSession",
			ServerStreams: true,
		},
	},
	Metadata: "audio.proto",
}
