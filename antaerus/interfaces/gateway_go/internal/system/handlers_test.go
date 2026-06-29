package system

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/config"
)

func TestHandleHealthReturnsGatewayHealth(t *testing.T) {
	handlers := NewHandlers(testHandlersConfig())
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	recorder := httptest.NewRecorder()

	handlers.HandleHealth(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
}

func TestHandleSystemStatusReturnsAggregatedPayload(t *testing.T) {
	handlers := NewHandlers(testHandlersConfig())
	request := httptest.NewRequest(http.MethodGet, "/api/v1/system/status", nil)
	recorder := httptest.NewRecorder()

	handlers.HandleSystemStatus(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
}

func testHandlersConfig() config.Config {
	return config.Config{
		Environment:       "test",
		Port:              8080,
		Version:           "0.1.0",
		WebURL:            "http://localhost:5173",
		BrainBaseURL:      "http://127.0.0.1:1",
		EngineHTTPURL:     "http://127.0.0.1:2",
		EngineGRPCTarget:  "127.0.0.1:3",
		RequestTimeout:    20 * time.Millisecond,
		ReadHeaderTimeout: 20 * time.Millisecond,
		ShutdownTimeout:   20 * time.Millisecond,
		IdleTimeout:       20 * time.Millisecond,
		WriteTimeout:      20 * time.Millisecond,
	}
}
