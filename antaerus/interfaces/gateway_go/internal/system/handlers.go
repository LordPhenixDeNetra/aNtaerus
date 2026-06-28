package system

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
)

type Handlers struct {
	config     config.Config
	httpClient *http.Client
}

func NewHandlers(cfg config.Config) Handlers {
	return Handlers{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

func (h Handlers) HandleHealth(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, clients.ServiceHealth{
		Name:      "gateway_go",
		Status:    "healthy",
		Version:   h.config.Version,
		Port:      h.config.Port,
		URL:       "http://localhost:" + strconv.Itoa(h.config.Port),
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
		Details:   "Gateway foundation service operational",
	})
}

func (h Handlers) HandleServices(writer http.ResponseWriter, request *http.Request) {
	writeJSON(writer, http.StatusOK, h.collectServices(request))
}

func (h Handlers) HandleSystemStatus(writer http.ResponseWriter, request *http.Request) {
	services := h.collectServices(request)
	capabilities := h.collectCapabilities(request)
	writeJSON(writer, http.StatusOK, clients.SystemStatus{
		Product:      "aNtaerus",
		Phase:        "foundation",
		Environment:  h.config.Environment,
		Services:     services,
		Capabilities: capabilities,
	})
}

func (h Handlers) collectServices(request *http.Request) []clients.ServiceHealth {
	ctx := request.Context()

	return []clients.ServiceHealth{
		{
			Name:      "web",
			Status:    "healthy",
			Version:   "0.1.0",
			Port:      5173,
			URL:       h.config.WebURL,
			CheckedAt: time.Now().UTC().Format(time.RFC3339),
			Details:   "Frontend foundation dashboard configured",
		},
		{
			Name:      "gateway_go",
			Status:    "healthy",
			Version:   h.config.Version,
			Port:      h.config.Port,
			URL:       "http://localhost:" + strconv.Itoa(h.config.Port),
			CheckedAt: time.Now().UTC().Format(time.RFC3339),
			Details:   "Gateway foundation service operational",
		},
		clients.FetchHealth(ctx, h.httpClient, clients.NewPythonClient(h.config.PythonURL)),
		clients.FetchHealth(ctx, h.httpClient, clients.NewRustClient(h.config.RustURL)),
	}
}

func (h Handlers) collectCapabilities(request *http.Request) []clients.ServiceCapabilities {
	ctx := request.Context()

	return []clients.ServiceCapabilities{
		{
			Name:         "web",
			Version:      "0.1.0",
			Runtime:      "web",
			Capabilities: []string{"dashboard", "system-status-view", "service-observability"},
		},
		{
			Name:         "gateway_go",
			Version:      h.config.Version,
			Runtime:      "go",
			Capabilities: []string{"healthcheck", "service-aggregation", "http-api"},
		},
		clients.FetchCapabilities(ctx, h.httpClient, clients.NewPythonClient(h.config.PythonURL)),
		clients.FetchCapabilities(ctx, h.httpClient, clients.NewRustClient(h.config.RustURL)),
	}
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}

