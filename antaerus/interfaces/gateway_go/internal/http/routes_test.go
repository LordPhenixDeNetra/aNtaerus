package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
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

	cfg := config.Config{
		Environment:       "test",
		Port:              8080,
		Version:           "0.1.0",
		WebURL:            "http://localhost:5173",
		BrainBaseURL:      brainServer.URL,
		EngineHTTPURL:     engineServer.URL,
		EngineGRPCTarget:  "127.0.0.1:1",
		RequestTimeout:    50 * time.Millisecond,
		ReadHeaderTimeout: 50 * time.Millisecond,
		ShutdownTimeout:   50 * time.Millisecond,
		IdleTimeout:       50 * time.Millisecond,
		WriteTimeout:      50 * time.Millisecond,
	}

	mux := NewMux(system.NewHandlers(cfg))
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
