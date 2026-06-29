package config

import "testing"

func TestLoadUsesEnvironmentOverrides(t *testing.T) {
	t.Setenv("ANTAERUS_ENV", "test")
	t.Setenv("ANTAERUS_GATEWAY_PORT", "9090")
	t.Setenv("ANTAERUS_GATEWAY_VERSION", "1.2.3")
	t.Setenv("ANTAERUS_WEB_URL", "http://localhost:5174")
	t.Setenv("ANTAERUS_BRAIN_URL", "http://localhost:8001")
	t.Setenv("ANTAERUS_ENGINE_URL", "http://localhost:7002")
	t.Setenv("ANTAERUS_ENGINE_GRPC_TARGET", "localhost:7003")
	t.Setenv("ANTAERUS_GATEWAY_REQUEST_TIMEOUT_MS", "750")
	t.Setenv("ANTAERUS_GATEWAY_READ_HEADER_TIMEOUT_MS", "600")
	t.Setenv("ANTAERUS_GATEWAY_SHUTDOWN_TIMEOUT_MS", "1200")
	t.Setenv("ANTAERUS_GATEWAY_IDLE_TIMEOUT_MS", "900")
	t.Setenv("ANTAERUS_GATEWAY_WRITE_TIMEOUT_MS", "950")
	t.Setenv("ANTAERUS_GATEWAY_TLS_CERT_FILE", "")
	t.Setenv("ANTAERUS_GATEWAY_TLS_KEY_FILE", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("expected config load to succeed, got error: %v", err)
	}

	if cfg.Environment != "test" {
		t.Fatalf("expected environment test, got %q", cfg.Environment)
	}

	if cfg.Port != 9090 {
		t.Fatalf("expected port 9090, got %d", cfg.Port)
	}

	if cfg.BrainBaseURL != "http://localhost:8001" {
		t.Fatalf("expected brain URL override, got %q", cfg.BrainBaseURL)
	}

	if cfg.EngineGRPCTarget != "localhost:7003" {
		t.Fatalf("expected grpc target override, got %q", cfg.EngineGRPCTarget)
	}
}

func TestValidateRejectsIncompleteTLSConfiguration(t *testing.T) {
	cfg := Config{
		Environment:       "test",
		Port:              8080,
		Version:           "0.1.0",
		WebURL:            "http://localhost:5173",
		BrainBaseURL:      "http://localhost:8000",
		EngineHTTPURL:     "http://localhost:7000",
		EngineGRPCTarget:  "localhost:7001",
		RequestTimeout:    2,
		ReadHeaderTimeout: 2,
		ShutdownTimeout:   2,
		IdleTimeout:       2,
		WriteTimeout:      2,
		TLSCertFile:       "server.crt",
	}

	if err := cfg.Validate(); err == nil {
		t.Fatal("expected TLS validation error, got nil")
	}
}

func TestGatewayURLUsesHTTPSWhenTLSIsConfigured(t *testing.T) {
	cfg := Config{
		Port:        8443,
		TLSCertFile: "server.crt",
		TLSKeyFile:  "server.key",
	}

	if got := cfg.GatewayURL(); got != "https://localhost:8443" {
		t.Fatalf("expected https gateway URL, got %q", got)
	}
}
