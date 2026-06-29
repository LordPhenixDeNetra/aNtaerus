package clients

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/gen/enginepb"
)

type fakeEngineGRPCClient struct {
	healthResponse       *enginepb.HealthResponse
	healthError          error
	capabilitiesResponse *enginepb.CapabilitiesResponse
	capabilitiesError    error
}

func (client fakeEngineGRPCClient) GetHealth(context.Context) (*enginepb.HealthResponse, error) {
	return client.healthResponse, client.healthError
}

func (client fakeEngineGRPCClient) GetCapabilities(context.Context) (*enginepb.CapabilitiesResponse, error) {
	return client.capabilitiesResponse, client.capabilitiesError
}

func (client fakeEngineGRPCClient) Close() error {
	return nil
}

type failingHTTPClient struct{}

func (failingHTTPClient) Do(*http.Request) (*http.Response, error) {
	return nil, errors.New("http unavailable")
}

func TestEngineRuntimeClientPrefersGRPCForHealth(t *testing.T) {
	runtimeClient := NewEngineRuntimeClient(&http.Client{Timeout: time.Second}, "http://localhost:7000", "localhost:7001", time.Second)
	runtimeClient.dialGRPC = func(context.Context, string) (engineHealthCapabilitiesClient, error) {
		return fakeEngineGRPCClient{
			healthResponse: &enginepb.HealthResponse{
				Name:      "engine_rust",
				Status:    "healthy",
				Version:   "0.1.0",
				Port:      7001,
				Url:       "grpc://engine",
				CheckedAt: "2026-01-01T00:00:00Z",
				Details:   "grpc ok",
			},
		}, nil
	}

	health := runtimeClient.FetchHealth(context.Background())

	if health.Source != "grpc" {
		t.Fatalf("expected grpc source, got %q", health.Source)
	}

	if health.URL != "grpc://engine" {
		t.Fatalf("expected grpc health payload, got %q", health.URL)
	}
}

func TestEngineRuntimeClientFallsBackToHTTPForHealth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/health" {
			t.Fatalf("expected /health fallback, got %s", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"name":"engine_rust","status":"healthy","version":"0.1.0","port":7000,"url":"http://localhost:7000","checkedAt":"2026-01-01T00:00:00Z","details":"http ok"}`))
	}))
	defer server.Close()

	runtimeClient := NewEngineRuntimeClient(server.Client(), server.URL, "localhost:7001", time.Second)
	runtimeClient.dialGRPC = func(context.Context, string) (engineHealthCapabilitiesClient, error) {
		return nil, errors.New("grpc unavailable")
	}

	health := runtimeClient.FetchHealth(context.Background())

	if health.Source != "http-fallback" {
		t.Fatalf("expected http-fallback source, got %q", health.Source)
	}

	if health.Status != "healthy" {
		t.Fatalf("expected healthy fallback status, got %q", health.Status)
	}
}

func TestEngineRuntimeClientReturnsOfflineWhenGRPCAndHTTPFail(t *testing.T) {
	runtimeClient := EngineRuntimeClient{
		httpClient:     failingHTTPClient{},
		httpService:    NewEngineHTTPClient("http://localhost:7000"),
		grpcTarget:     "localhost:7001",
		requestTimeout: time.Second,
		dialGRPC: func(context.Context, string) (engineHealthCapabilitiesClient, error) {
			return nil, errors.New("grpc unavailable")
		},
	}

	health := runtimeClient.FetchHealth(context.Background())

	if health.Status != "offline" {
		t.Fatalf("expected offline status, got %q", health.Status)
	}
}

func TestEngineRuntimeClientFallsBackToHTTPForCapabilities(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/capabilities" {
			t.Fatalf("expected /capabilities fallback, got %s", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"name":"engine_rust","version":"0.1.0","runtime":"rust","capabilities":["grpc","http"]}`))
	}))
	defer server.Close()

	runtimeClient := NewEngineRuntimeClient(server.Client(), server.URL, "localhost:7001", time.Second)
	runtimeClient.dialGRPC = func(context.Context, string) (engineHealthCapabilitiesClient, error) {
		return nil, errors.New("grpc unavailable")
	}

	capabilities := runtimeClient.FetchCapabilities(context.Background())

	if capabilities.Source != "http-fallback" {
		t.Fatalf("expected http-fallback source, got %q", capabilities.Source)
	}

	if len(capabilities.Capabilities) != 2 {
		t.Fatalf("expected fallback capabilities, got %#v", capabilities.Capabilities)
	}
}
