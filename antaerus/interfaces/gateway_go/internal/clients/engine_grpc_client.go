package clients

import (
	"context"
	"time"

	"antaerus/interfaces/gateway_go/internal/gen/audiopb"
	"antaerus/interfaces/gateway_go/internal/gen/enginepb"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type EngineGRPCClient struct {
	conn        *grpc.ClientConn
	client      enginepb.EngineRuntimeClient
	audioClient audiopb.AudioRuntimeClient
}

func NewEngineGRPCClient(ctx context.Context, target string) (*EngineGRPCClient, error) {
	connection, err := grpc.DialContext(
		ctx,
		target,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
	)
	if err != nil {
		return nil, err
	}

	return &EngineGRPCClient{
		conn:        connection,
		client:      enginepb.NewEngineRuntimeClient(connection),
		audioClient: audiopb.NewAudioRuntimeClient(connection),
	}, nil
}

func (client *EngineGRPCClient) Close() error {
	if client == nil || client.conn == nil {
		return nil
	}

	return client.conn.Close()
}

func (client *EngineGRPCClient) Ping(
	ctx context.Context,
	requestID string,
) (*enginepb.PingResponse, error) {
	return client.client.Ping(ctx, &enginepb.PingRequest{
		RequestId:      requestID,
		SentAtUnixNano: time.Now().UnixNano(),
	})
}

func (client *EngineGRPCClient) GetHealth(
	ctx context.Context,
) (*enginepb.HealthResponse, error) {
	return client.client.GetHealth(ctx, &enginepb.HealthRequest{})
}

func (client *EngineGRPCClient) GetCapabilities(
	ctx context.Context,
) (*enginepb.CapabilitiesResponse, error) {
	return client.client.GetCapabilities(ctx, &enginepb.CapabilitiesRequest{})
}

func (client *EngineGRPCClient) StartVoiceSession(
	ctx context.Context,
	sessionID string,
	language string,
) (grpc.ServerStreamingClient[audiopb.VoiceEvent], error) {
	return client.audioClient.StartVoiceSession(ctx, &audiopb.StartVoiceSessionRequest{
		SessionId: sessionID,
		Language:  language,
	})
}

func (client *EngineGRPCClient) StopVoiceSession(
	ctx context.Context,
	sessionID string,
) (*audiopb.StopVoiceSessionResponse, error) {
	return client.audioClient.StopVoiceSession(ctx, &audiopb.StopVoiceSessionRequest{
		SessionId: sessionID,
	})
}

func (client *EngineGRPCClient) Speak(
	ctx context.Context,
	sessionID string,
	text string,
) (*audiopb.SpeakResponse, error) {
	return client.audioClient.Speak(ctx, &audiopb.SpeakRequest{
		SessionId: sessionID,
		Text:      text,
	})
}
