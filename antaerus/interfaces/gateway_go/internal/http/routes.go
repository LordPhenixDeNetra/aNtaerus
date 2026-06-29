package httpapi

import (
	"net/http"

	"antaerus/interfaces/gateway_go/internal/system"
)

func NewMux(handlers system.Handlers) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", handlers.HandleHealth)
	mux.HandleFunc("/api/v1/health", handlers.HandleAggregatedHealth)
	mux.HandleFunc("/api/v1/system/services", handlers.HandleServices)
	mux.HandleFunc("/api/v1/system/status", handlers.HandleSystemStatus)
	return mux
}
