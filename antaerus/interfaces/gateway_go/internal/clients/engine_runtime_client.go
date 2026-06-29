package clients

import (
	"context"
	"net/http"
	"time"

	"antaerus/interfaces/gateway_go/internal/gen/enginepb"
)

type engineHealthCapabilitiesClient interface {
	GetHealth(ctx context.Context) (*enginepb.HealthResponse, error)
	GetCapabilities(ctx context.Context) (*enginepb.CapabilitiesResponse, error)
	Close() error
}

type engineGRPCDialer func(ctx context.Context, target string) (engineHealthCapabilitiesClient, error)

type EngineRuntimeClient struct {
	httpClient     httpClient
	httpService    ServiceClient
	grpcTarget     string
	requestTimeout time.Duration
	dialGRPC       engineGRPCDialer
}

type httpClient interface {
	Do(req *http.Request) (*http.Response, error)
}

func NewEngineRuntimeClient(
	httpClient *http.Client,
	httpBaseURL string,
	grpcTarget string,
	requestTimeout time.Duration,
) EngineRuntimeClient {
	client := httpClient
	if client == nil {
		client = &http.Client{Timeout: requestTimeout}
	}

	return EngineRuntimeClient{
		httpClient:     client,
		httpService:    NewEngineHTTPClient(httpBaseURL),
		grpcTarget:     grpcTarget,
		requestTimeout: requestTimeout,
		dialGRPC: func(ctx context.Context, target string) (engineHealthCapabilitiesClient, error) {
			return NewEngineGRPCClient(ctx, target)
		},
	}
}

func (client EngineRuntimeClient) FetchHealth(ctx context.Context) ServiceHealth {
	grpcClient, grpcCtx, cancel, err := client.connect(ctx)
	if err == nil {
		defer cancel()
		defer closeGRPC(grpcClient)

		response, grpcErr := grpcClient.GetHealth(grpcCtx)
		if grpcErr == nil {
			return ServiceHealth{
				Name:      response.GetName(),
				Status:    response.GetStatus(),
				Version:   response.GetVersion(),
				Port:      int(response.GetPort()),
				URL:       response.GetUrl(),
				CheckedAt: response.GetCheckedAt(),
				Details:   response.GetDetails(),
				Source:    "grpc",
			}
		}
	}

	requestCtx, cancel := context.WithTimeout(ctx, client.requestTimeout)
	defer cancel()

	fallback := FetchHealth(requestCtx, client.httpClient, client.httpService)
	if fallback.Source == "http" {
		fallback.Source = "http-fallback"
	}

	return fallback
}

func (client EngineRuntimeClient) FetchCapabilities(ctx context.Context) ServiceCapabilities {
	grpcClient, grpcCtx, cancel, err := client.connect(ctx)
	if err == nil {
		defer cancel()
		defer closeGRPC(grpcClient)

		response, grpcErr := grpcClient.GetCapabilities(grpcCtx)
		if grpcErr == nil {
			return ServiceCapabilities{
				Name:         response.GetName(),
				Version:      response.GetVersion(),
				Runtime:      response.GetRuntime(),
				Capabilities: response.GetCapabilities(),
				Source:       "grpc",
			}
		}
	}

	requestCtx, cancel := context.WithTimeout(ctx, client.requestTimeout)
	defer cancel()

	fallback := FetchCapabilities(requestCtx, client.httpClient, client.httpService)
	if fallback.Source == "http" {
		fallback.Source = "http-fallback"
	}

	return fallback
}

func (client EngineRuntimeClient) connect(
	ctx context.Context,
) (engineHealthCapabilitiesClient, context.Context, context.CancelFunc, error) {
	requestCtx, cancel := context.WithTimeout(ctx, client.requestTimeout)
	grpcClient, err := client.dialGRPC(requestCtx, client.grpcTarget)
	if err != nil {
		cancel()
		return nil, nil, nil, err
	}

	return grpcClient, requestCtx, cancel, nil
}

func closeGRPC(client engineHealthCapabilitiesClient) {
	if client == nil {
		return
	}

	_ = client.Close()
}
