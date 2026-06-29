package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDevTokenHandlerIssuesJWT(t *testing.T) {
	cfg := websocketTestConfig()
	handler := NewDevTokenHandler(cfg, NewAuthenticator(cfg))

	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/auth/dev-token",
		strings.NewReader(`{"subject":"web-user","role":"user"}`),
	)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}

	var payload devTokenResponse
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("expected valid JSON response, got %v", err)
	}
	if payload.Token == "" {
		t.Fatal("expected non-empty token")
	}
}
