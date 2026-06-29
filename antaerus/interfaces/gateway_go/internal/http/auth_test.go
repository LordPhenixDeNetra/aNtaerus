package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/kernel/settings"
)

func TestAuthenticatorIssuesAndValidatesJWT(t *testing.T) {
	auth := newTestAuthenticator()

	token, err := auth.IssueToken("user-123", "user")
	if err != nil {
		t.Fatalf("expected JWT issuance to succeed, got error: %v", err)
	}

	claims, err := auth.ValidateToken(token)
	if err != nil {
		t.Fatalf("expected JWT validation to succeed, got error: %v", err)
	}

	if claims.Subject != "user-123" {
		t.Fatalf("expected subject user-123, got %q", claims.Subject)
	}

	if claims.Role != "user" {
		t.Fatalf("expected role user, got %q", claims.Role)
	}
}

func TestAuthenticatorRejectsExpiredJWT(t *testing.T) {
	auth := newTestAuthenticator()
	auth.now = func() time.Time {
		return time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	}

	token, err := auth.IssueToken("user-123", "user")
	if err != nil {
		t.Fatalf("expected JWT issuance to succeed, got error: %v", err)
	}

	auth.now = func() time.Time {
		return time.Date(2026, 6, 29, 12, 0, 0, 0, time.UTC)
	}

	if _, err := auth.ValidateToken(token); err == nil {
		t.Fatal("expected expired JWT to be rejected")
	}
}

func TestRequireJWTRejectsMissingBearerToken(t *testing.T) {
	auth := newTestAuthenticator()
	handler := auth.RequireJWT(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestRequireJWTInjectsClaimsIntoContext(t *testing.T) {
	auth := newTestAuthenticator()
	token, err := auth.IssueToken("user-123", "admin")
	if err != nil {
		t.Fatalf("expected JWT issuance to succeed, got error: %v", err)
	}

	handler := auth.RequireJWT(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		claims, ok := ClaimsFromContext(request.Context())
		if !ok {
			t.Fatal("expected claims in request context")
		}

		if claims.Role != "admin" {
			t.Fatalf("expected admin role, got %q", claims.Role)
		}

		writer.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", recorder.Code)
	}
}

func TestAuthenticateWebSocketReadsTokenFromQuery(t *testing.T) {
	auth := newTestAuthenticator()
	token, err := auth.IssueToken("user-123", "user")
	if err != nil {
		t.Fatalf("expected JWT issuance to succeed, got error: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/api/v1/ws?token="+token, nil)
	claims, err := auth.AuthenticateWebSocket(request)
	if err != nil {
		t.Fatalf("expected WebSocket auth to succeed, got error: %v", err)
	}

	if claims.Subject != "user-123" {
		t.Fatalf("expected user-123 subject, got %q", claims.Subject)
	}
}

func newTestAuthenticator() Authenticator {
	cfg := config.Config{
		Environment:        "test",
		Port:               8080,
		Version:            "0.1.0",
		WebURL:             "http://localhost:5173",
		BrainBaseURL:       "http://localhost:8000",
		EngineHTTPURL:      "http://localhost:7000",
		EngineGRPCTarget:   "localhost:7001",
		RequestTimeout:     time.Second,
		ReadHeaderTimeout:  time.Second,
		ShutdownTimeout:    time.Second,
		IdleTimeout:        time.Second,
		WriteTimeout:       time.Second,
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

	auth := NewAuthenticator(cfg)
	auth.now = func() time.Time {
		return time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	}
	return auth
}
