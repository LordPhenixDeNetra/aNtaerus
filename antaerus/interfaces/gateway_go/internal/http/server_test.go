package httpapi

import (
	"net/http"
	"testing"
	"time"
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

	err := Listen(&http.Server{}, websocketTestConfig())
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

	cfg := websocketTestConfig()
	cfg.Port = 8443
	cfg.TLSCertFile = "server.crt"
	cfg.TLSKeyFile = "server.key"

	err := Listen(&http.Server{}, cfg)
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
	cfg := websocketTestConfig()
	cfg.ReadHeaderTimeout = 60 * time.Millisecond
	cfg.ShutdownTimeout = 70 * time.Millisecond
	cfg.IdleTimeout = 80 * time.Millisecond
	cfg.WriteTimeout = 90 * time.Millisecond

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
