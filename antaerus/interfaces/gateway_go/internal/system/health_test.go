package system

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/kernel/settings"
)

func TestAggregatedHealthUsesHTTPFallbackForEngine(t *testing.T) {
	brainServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"name":"brain_python","status":"healthy","version":"0.1.0","port":8000,"url":"http://localhost:8000","checkedAt":"2026-01-01T00:00:00Z","details":"brain ok"}`))
	}))
	defer brainServer.Close()

	engineServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"name":"engine_rust","status":"healthy","version":"0.1.0","port":7000,"url":"http://localhost:7000","checkedAt":"2026-01-01T00:00:00Z","details":"engine http ok"}`))
	}))
	defer engineServer.Close()

	healthService := NewHealthService(testGatewayConfig(brainServer.URL, engineServer.URL), &http.Client{Timeout: 100 * time.Millisecond})

	response := healthService.AggregatedHealth(context.Background())

	if response.Status != "healthy" {
		t.Fatalf("expected healthy aggregated status, got %q", response.Status)
	}

	engine := findService(t, response.Services, "engine_rust")
	if engine.Source != "http-fallback" {
		t.Fatalf("expected engine source http-fallback, got %q", engine.Source)
	}
}

func TestSystemStatusReturnsCapabilities(t *testing.T) {
	brainServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/health":
			_, _ = writer.Write([]byte(`{"name":"brain_python","status":"healthy","version":"0.1.0","port":8000,"url":"http://localhost:8000","checkedAt":"2026-01-01T00:00:00Z","details":"brain ok"}`))
		case "/internal/capabilities":
			_, _ = writer.Write([]byte(`{"name":"brain_python","version":"0.1.0","runtime":"python","capabilities":["llm"]}`))
		default:
			t.Fatalf("unexpected brain path %s", request.URL.Path)
		}
	}))
	defer brainServer.Close()

	engineServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/health":
			_, _ = writer.Write([]byte(`{"name":"engine_rust","status":"healthy","version":"0.1.0","port":7000,"url":"http://localhost:7000","checkedAt":"2026-01-01T00:00:00Z","details":"engine ok"}`))
		case "/capabilities":
			_, _ = writer.Write([]byte(`{"name":"engine_rust","version":"0.1.0","runtime":"rust","capabilities":["grpc","http"]}`))
		default:
			t.Fatalf("unexpected engine path %s", request.URL.Path)
		}
	}))
	defer engineServer.Close()

	healthService := NewHealthService(testGatewayConfig(brainServer.URL, engineServer.URL), &http.Client{Timeout: 100 * time.Millisecond})

	status := healthService.SystemStatus(context.Background())
	engineCapabilities := findCapabilities(t, status.Capabilities, "engine_rust")

	if engineCapabilities.Source != "http-fallback" {
		t.Fatalf("expected engine capabilities source http-fallback, got %q", engineCapabilities.Source)
	}
}

func TestAggregatedHealthBecomesDegradedWhenDependenciesAreOffline(t *testing.T) {
	cfg := testGatewayConfig("http://127.0.0.1:1", "http://127.0.0.1:2")
	cfg.RequestTimeout = 20 * time.Millisecond

	healthService := NewHealthService(cfg, &http.Client{Timeout: cfg.RequestTimeout})
	response := healthService.AggregatedHealth(context.Background())

	if response.Status != "degraded" {
		t.Fatalf("expected degraded aggregated status, got %q", response.Status)
	}
}

func testGatewayConfig(brainURL string, engineURL string) config.Config {
	return config.Config{
		Environment:        "test",
		Port:               8080,
		Version:            "0.1.0",
		WebURL:             "http://localhost:5173",
		BrainBaseURL:       brainURL,
		EngineHTTPURL:      engineURL,
		EngineGRPCTarget:   "127.0.0.1:1",
		RequestTimeout:     50 * time.Millisecond,
		ReadHeaderTimeout:  50 * time.Millisecond,
		ShutdownTimeout:    50 * time.Millisecond,
		IdleTimeout:        50 * time.Millisecond,
		WriteTimeout:       50 * time.Millisecond,
		JWTSecret:          settings.SecretString("test-secret"),
		JWTIssuer:          "test-issuer",
		JWTAudience:        "test-audience",
		JWTTokenTTL:        time.Hour,
		WSHeartbeat:        time.Second,
		HTTPRateLimitRPS:   5,
		HTTPRateLimitBurst: 10,
		WSConnectRateRPS:   2,
		WSConnectBurst:     3,
		WSMessageRateRPS:   10,
		WSMessageBurst:     20,
	}
}

func findService(t *testing.T, services []clients.ServiceHealth, name string) clients.ServiceHealth {
	t.Helper()

	for _, service := range services {
		if service.Name == name {
			return service
		}
	}

	t.Fatalf("service %q not found", name)
	return clients.ServiceHealth{}
}

func findCapabilities(
	t *testing.T,
	capabilities []clients.ServiceCapabilities,
	name string,
) clients.ServiceCapabilities {
	t.Helper()

	for _, capability := range capabilities {
		if capability.Name == name {
			return capability
		}
	}

	t.Fatalf("capabilities for %q not found", name)
	return clients.ServiceCapabilities{}
}
