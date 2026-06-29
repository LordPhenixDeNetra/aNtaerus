package httpapi

import (
	"net/http"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/config"
)

func TestListenUsesPlainHTTPWhenTLSIsDisabled(t *testing.T) {
	plainCalled := false
	tlsCalled := false

	originalPlain := listenAndServe
	originalTLS := listenAndServeTLS
	t.Cleanup(func() {
		listenAndServe = originalPlain
		listenAndServeTLS = originalTLS
	})

	listenAndServe = func(*http.Server) error {
		plainCalled = true
		return http.ErrServerClosed
	}
	listenAndServeTLS = func(*http.Server, string, string) error {
		tlsCalled = true
		return http.ErrServerClosed
	}

	err := Listen(&http.Server{}, config.Config{Port: 8080})
	if err != nil {
		t.Fatalf("expected nil error on server closed, got %v", err)
	}

	if !plainCalled {
		t.Fatal("expected plain ListenAndServe path to be called")
	}

	if tlsCalled {
		t.Fatal("did not expect TLS path when TLS is disabled")
	}
}

func TestListenUsesTLSWhenConfigured(t *testing.T) {
	plainCalled := false
	tlsCalled := false

	originalPlain := listenAndServe
	originalTLS := listenAndServeTLS
	t.Cleanup(func() {
		listenAndServe = originalPlain
		listenAndServeTLS = originalTLS
	})

	listenAndServe = func(*http.Server) error {
		plainCalled = true
		return nil
	}
	listenAndServeTLS = func(server *http.Server, certFile string, keyFile string) error {
		tlsCalled = certFile == "server.crt" && keyFile == "server.key"
		return http.ErrServerClosed
	}

	err := Listen(&http.Server{}, config.Config{
		Port:        8443,
		TLSCertFile: "server.crt",
		TLSKeyFile:  "server.key",
	})
	if err != nil {
		t.Fatalf("expected nil error on server closed, got %v", err)
	}

	if plainCalled {
		t.Fatal("did not expect plain path when TLS is configured")
	}

	if !tlsCalled {
		t.Fatal("expected TLS path to be called with certificate and key")
	}
}

func TestNewServerUsesConfiguredTimeouts(t *testing.T) {
	cfg := config.Config{
		Port:              8080,
		Environment:       "test",
		Version:           "0.1.0",
		WebURL:            "http://localhost:5173",
		BrainBaseURL:      "http://localhost:8000",
		EngineHTTPURL:     "http://localhost:7000",
		EngineGRPCTarget:  "127.0.0.1:1",
		RequestTimeout:    50 * time.Millisecond,
		ReadHeaderTimeout: 60 * time.Millisecond,
		ShutdownTimeout:   70 * time.Millisecond,
		IdleTimeout:       80 * time.Millisecond,
		WriteTimeout:      90 * time.Millisecond,
	}

	server := NewServer(cfg)

	if server.ReadHeaderTimeout != 60*time.Millisecond {
		t.Fatalf("expected read header timeout 60ms, got %s", server.ReadHeaderTimeout)
	}

	if server.IdleTimeout != 80*time.Millisecond {
		t.Fatalf("expected idle timeout 80ms, got %s", server.IdleTimeout)
	}

	if server.WriteTimeout != 90*time.Millisecond {
		t.Fatalf("expected write timeout 90ms, got %s", server.WriteTimeout)
	}
}
