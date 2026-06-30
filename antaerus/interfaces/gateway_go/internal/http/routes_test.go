package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/system"
)

func TestNewMuxExposesAggregatedHealthRoute(t *testing.T) {
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

	cfg := websocketTestConfig()
	cfg.BrainBaseURL = brainServer.URL
	cfg.EngineHTTPURL = engineServer.URL

	mux := NewMux(cfg, system.NewHandlers(cfg))
	request := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	recorder := httptest.NewRecorder()

	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 from aggregated health route, got %d", recorder.Code)
	}

	var payload clients.AggregatedHealth
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("expected valid aggregated health payload, got error: %v", err)
	}

	if payload.Product != "aNtaerus" {
		t.Fatalf("expected product aNtaerus, got %q", payload.Product)
	}
}

func TestNewMuxServesFrontendIndexForSPARoutes(t *testing.T) {
	tempDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(tempDir, "index.html"), []byte("<html>chat</html>"), 0o600); err != nil {
		t.Fatalf("write index.html: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tempDir, "app.js"), []byte("console.log('ok')"), 0o600); err != nil {
		t.Fatalf("write app.js: %v", err)
	}

	previousCandidates := webDistDirCandidates
	webDistDirCandidates = []string{tempDir}
	t.Cleanup(func() {
		webDistDirCandidates = previousCandidates
	})

	cfg := websocketTestConfig()
	mux := NewMux(cfg, system.NewHandlers(cfg))

	spaRequest := httptest.NewRequest(http.MethodGet, "/setup", nil)
	spaRecorder := httptest.NewRecorder()
	mux.ServeHTTP(spaRecorder, spaRequest)

	if spaRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 for SPA fallback, got %d", spaRecorder.Code)
	}
	if body := spaRecorder.Body.String(); body != "<html>chat</html>" {
		t.Fatalf("expected index.html body, got %q", body)
	}

	assetRequest := httptest.NewRequest(http.MethodGet, "/app.js", nil)
	assetRecorder := httptest.NewRecorder()
	mux.ServeHTTP(assetRecorder, assetRequest)

	if assetRecorder.Code != http.StatusOK {
		t.Fatalf("expected 200 for asset, got %d", assetRecorder.Code)
	}
	if body := assetRecorder.Body.String(); body != "console.log('ok')" {
		t.Fatalf("expected asset body, got %q", body)
	}
}

func TestNewMuxAllowsConfiguredWebOriginPreflight(t *testing.T) {
	cfg := websocketTestConfig()
	mux := NewMux(cfg, system.NewHandlers(cfg))

	request := httptest.NewRequest(http.MethodOptions, "/api/v1/auth/dev-token", nil)
	request.Header.Set("Origin", cfg.WebURL)
	request.Header.Set("Access-Control-Request-Method", http.MethodPost)
	request.Header.Set("Access-Control-Request-Headers", "Content-Type")

	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for CORS preflight, got %d", recorder.Code)
	}
	if allowOrigin := recorder.Header().Get("Access-Control-Allow-Origin"); allowOrigin != cfg.WebURL {
		t.Fatalf("expected allow origin %q, got %q", cfg.WebURL, allowOrigin)
	}
	if allowMethods := recorder.Header().Get("Access-Control-Allow-Methods"); allowMethods != "GET, POST, OPTIONS" {
		t.Fatalf("expected allow methods header, got %q", allowMethods)
	}
}

func TestNewMuxIncludesCORSHeadersOnDevTokenResponse(t *testing.T) {
	cfg := websocketTestConfig()
	mux := NewMux(cfg, system.NewHandlers(cfg))

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/auth/dev-token",
		bytes.NewBufferString(`{"subject":"web-dev-user","role":"user"}`),
	)
	request.Header.Set("Origin", cfg.WebURL)
	request.Header.Set("Content-Type", "application/json")

	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200 for dev token route, got %d", recorder.Code)
	}
	if allowOrigin := recorder.Header().Get("Access-Control-Allow-Origin"); allowOrigin != cfg.WebURL {
		t.Fatalf("expected allow origin %q, got %q", cfg.WebURL, allowOrigin)
	}
}
