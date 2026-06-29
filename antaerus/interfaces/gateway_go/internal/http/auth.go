package httpapi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"antaerus/interfaces/gateway_go/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const claimsContextKey contextKey = "gatewayClaims"

type Claims struct {
	Role string `json:"role"`
	jwt.RegisteredClaims
}

type Authenticator struct {
	config config.Config
	now    func() time.Time
}

func NewAuthenticator(cfg config.Config) Authenticator {
	return Authenticator{
		config: cfg,
		now:    time.Now,
	}
}

func (auth Authenticator) IssueToken(subject string, role string) (string, error) {
	if subject == "" {
		return "", errors.New("subject must not be empty")
	}

	claims := Claims{
		Role: role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			Issuer:    auth.config.JWTIssuer,
			Audience:  []string{auth.config.JWTAudience},
			IssuedAt:  jwt.NewNumericDate(auth.now().UTC()),
			ExpiresAt: jwt.NewNumericDate(auth.now().UTC().Add(auth.config.JWTTokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(auth.config.JWTSecret.Value()))
}

func (auth Authenticator) ValidateToken(raw string) (Claims, error) {
	if raw == "" {
		return Claims{}, errors.New("token must not be empty")
	}

	parsed, err := jwt.ParseWithClaims(raw, &Claims{}, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}

		return []byte(auth.config.JWTSecret.Value()), nil
	}, jwt.WithAudience(auth.config.JWTAudience), jwt.WithIssuer(auth.config.JWTIssuer), jwt.WithTimeFunc(auth.now))
	if err != nil {
		return Claims{}, err
	}

	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return Claims{}, errors.New("invalid JWT claims")
	}

	if claims.Subject == "" {
		return Claims{}, errors.New("JWT subject must not be empty")
	}

	return *claims, nil
}

func (auth Authenticator) RequireJWT(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		claims, err := auth.authenticateAuthorizationHeader(request)
		if err != nil {
			http.Error(writer, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
			return
		}

		next.ServeHTTP(writer, request.WithContext(WithClaims(request.Context(), claims)))
	})
}

func (auth Authenticator) AuthenticateWebSocket(request *http.Request) (Claims, error) {
	rawToken := request.URL.Query().Get("token")
	return auth.ValidateToken(rawToken)
}

func (auth Authenticator) authenticateAuthorizationHeader(request *http.Request) (Claims, error) {
	header := request.Header.Get("Authorization")
	if header == "" {
		return Claims{}, errors.New("missing Authorization header")
	}

	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return Claims{}, errors.New("Authorization header must use Bearer token")
	}

	return auth.ValidateToken(strings.TrimSpace(strings.TrimPrefix(header, prefix)))
}

func WithClaims(ctx context.Context, claims Claims) context.Context {
	return context.WithValue(ctx, claimsContextKey, claims)
}

func ClaimsFromContext(ctx context.Context) (Claims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(Claims)
	return claims, ok
}
