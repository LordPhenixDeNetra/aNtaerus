package httpapi

import (
	"net/http"

	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/system"
)

func NewMux(cfg config.Config, handlers system.Handlers) *http.ServeMux {
	mux := http.NewServeMux()
	healthService := system.NewHealthService(cfg, nil)
	authenticator := NewAuthenticator(cfg)
	rateLimiter := NewRateLimiter(cfg)
	hub := NewHub(cfg, authenticator, rateLimiter, healthService)

	mux.HandleFunc("/health", handlers.HandleHealth)
	mux.HandleFunc("/api/v1/health", handlers.HandleAggregatedHealth)
	mux.HandleFunc("/api/v1/system/services", handlers.HandleServices)
	mux.HandleFunc("/api/v1/system/status", handlers.HandleSystemStatus)
	mux.HandleFunc("/api/v1/ws", hub.ServeWS)
	return mux
}
