package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestRateLimitHTTPRejectsBurstOverflow(t *testing.T) {
	cfg := newTestAuthenticator().config
	cfg.HTTPRateLimitRPS = 100
	cfg.HTTPRateLimitBurst = 1

	limiter := NewRateLimiter(cfg)
	handler := limiter.RateLimitHTTP(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
	}))

	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.RemoteAddr = "127.0.0.1:1234"

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, request)
	if first.Code != http.StatusNoContent {
		t.Fatalf("expected first request to pass, got %d", first.Code)
	}

	second := httptest.NewRecorder()
	handler.ServeHTTP(second, request)
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("expected second request to be rate limited, got %d", second.Code)
	}
}

func TestAllowWSConnectRejectsBurstOverflow(t *testing.T) {
	cfg := newTestAuthenticator().config
	cfg.WSConnectRateRPS = 100
	cfg.WSConnectBurst = 1

	limiter := NewRateLimiter(cfg)
	claims := Claims{RegisteredClaims: registeredClaims("user-123")}

	if !limiter.AllowWSConnect(claims, "127.0.0.1") {
		t.Fatal("expected first WebSocket connect to pass")
	}

	if limiter.AllowWSConnect(claims, "127.0.0.1") {
		t.Fatal("expected second WebSocket connect to be rate limited")
	}
}

func TestAllowWSMessageRejectsBurstOverflow(t *testing.T) {
	cfg := newTestAuthenticator().config
	cfg.WSMessageRateRPS = 100
	cfg.WSMessageBurst = 1

	limiter := NewRateLimiter(cfg)
	claims := Claims{RegisteredClaims: registeredClaims("user-123")}

	if !limiter.AllowWSMessage("client-1", claims) {
		t.Fatal("expected first WebSocket message to pass")
	}

	if limiter.AllowWSMessage("client-1", claims) {
		t.Fatal("expected second WebSocket message to be rate limited")
	}
}

func registeredClaims(subject string) jwt.RegisteredClaims {
	now := time.Date(2026, 6, 29, 10, 0, 0, 0, time.UTC)
	return jwt.RegisteredClaims{
		Subject:   subject,
		Issuer:    "test-issuer",
		Audience:  []string{"test-audience"},
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(time.Hour)),
	}
}
