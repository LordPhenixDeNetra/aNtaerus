package system

import (
	"encoding/json"
	"net/http"

	"antaerus/interfaces/gateway_go/internal/config"
)

type Handlers struct {
	healthService HealthService
}

func NewHandlers(cfg config.Config) Handlers {
	return Handlers{
		healthService: NewHealthService(cfg, nil),
	}
}

func (h Handlers) HandleHealth(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, h.healthService.GatewayHealth())
}

func (h Handlers) HandleAggregatedHealth(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, h.healthService.AggregatedHealth(request.Context()))
}

func (h Handlers) HandleServices(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, h.healthService.Services(request.Context()))
}

func (h Handlers) HandleSystemStatus(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, h.healthService.SystemStatus(request.Context()))
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}
