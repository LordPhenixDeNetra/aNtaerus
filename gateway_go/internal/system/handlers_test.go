package system

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"antaerus/gateway_go/internal/config"
)

func TestHandleHealthReturnsGatewayHealth(t *testing.T) {
	handlers := NewHandlers(config.Load())
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	recorder := httptest.NewRecorder()

	handlers.HandleHealth(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
}

func TestHandleSystemStatusReturnsAggregatedPayload(t *testing.T) {
	handlers := NewHandlers(config.Load())
	request := httptest.NewRequest(http.MethodGet, "/api/v1/system/status", nil)
	recorder := httptest.NewRecorder()

	handlers.HandleSystemStatus(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
}
