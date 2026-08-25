package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/system"
)

func nowRFC3339() string {
	return time.Now().UTC().Format(time.RFC3339)
}

type MemoryHandlers struct {
	cfg    config.Config
	client clients.BrainMemoryClient
}

func NewMemoryHandlers(cfg config.Config, client clients.BrainMemoryClient) *MemoryHandlers {
	return &MemoryHandlers{cfg: cfg, client: client}
}

func memoryStatus(err error) int {
	if err == nil {
		return http.StatusOK
	}
	var statusErr interface{ StatusCode() int }
	if errors.As(err, &statusErr) {
		return statusErr.StatusCode()
	}
	var rawErr clients.BrainMissionError
	if errors.As(err, &rawErr) && rawErr.StatusCode >= 100 && rawErr.StatusCode < 600 {
		return rawErr.StatusCode
	}
	if errors.Is(err, clients.ErrMemoryNotFound) {
		return http.StatusNotFound
	}
	return http.StatusBadGateway
}

func (h *MemoryHandlers) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/memory")
	if path == "" {
		path = "/"
	}
	segments := strings.Split(strings.Trim(path, "/"), "/")
	q := r.URL.Query()

	switch {
	case len(segments) == 1 && segments[0] == "facts" && r.Method == http.MethodGet:
		query := q.Get("query")
		limit := 0
		if raw := q.Get("limit"); raw != "" {
			if n, err := strconv.Atoi(raw); err == nil && n > 0 {
				limit = n
			}
		}
		facts, err := h.client.ListFacts(r.Context(), query, limit)
		if err != nil {
			writeJSON(w, memoryStatus(err), map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"facts": facts})

	case len(segments) == 1 && segments[0] == "facts" && r.Method == http.MethodPost:
		var fact clients.FactRecord
		if err := json.NewDecoder(r.Body).Decode(&fact); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid payload"})
			return
		}
		created, err := h.client.UpsertFact(r.Context(), fact)
		if err != nil {
			writeJSON(w, memoryStatus(err), map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"fact": created})

	case len(segments) == 1 && segments[0] == "graph" && r.Method == http.MethodGet:
		graph, err := h.client.Graph(r.Context())
		if err != nil {
			writeJSON(w, memoryStatus(err), map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, graph)

	case len(segments) == 1 && segments[0] == "analytics" && r.Method == http.MethodGet:
		var out clients.AnalyticsSummary
		if err := h.client.Request(r.Context(), http.MethodGet, "/memory/analytics", nil, &out); err != nil {
			writeJSON(w, memoryStatus(err), map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)

	case len(segments) == 1 && segments[0] == "config" && r.Method == http.MethodGet:
		var out clients.ConfigSnapshot
		if err := h.client.Request(r.Context(), http.MethodGet, "/memory/config", nil, &out); err != nil {
			writeJSON(w, memoryStatus(err), map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)

	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "memory route not found: " + r.URL.Path})
	}
}

type AnalyticsHandlers struct {
	cfg    config.Config
	client clients.BrainMemoryClient
}

func NewAnalyticsHandlers(cfg config.Config, client clients.BrainMemoryClient) *AnalyticsHandlers {
	return &AnalyticsHandlers{cfg: cfg, client: client}
}

func (h *AnalyticsHandlers) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/analytics")
	if path == "" {
		path = "/"
	}
	segments := strings.Split(strings.Trim(path, "/"), "/")

	switch {
	case len(segments) == 0 || (len(segments) == 1 && segments[0] == ""):
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		var out clients.AnalyticsSummary
		if err := h.client.Request(r.Context(), http.MethodGet, "/memory/analytics", nil, &out); err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, out)
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "analytics route not found"})
	}
}

type ConfigHandlers struct {
	cfg    config.Config
	client clients.BrainMemoryClient
}

func NewConfigHandlers(cfg config.Config, client clients.BrainMemoryClient) *ConfigHandlers {
	return &ConfigHandlers{cfg: cfg, client: client}
}

func (h *ConfigHandlers) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/config")
	if path == "" {
		path = "/"
	}
	segments := strings.Split(strings.Trim(path, "/"), "/")

	switch {
	case len(segments) == 0 || (len(segments) == 1 && segments[0] == ""):
		switch r.Method {
		case http.MethodGet:
			var out clients.ConfigSnapshot
			if err := h.client.Request(r.Context(), http.MethodGet, "/memory/config", nil, &out); err != nil {
				writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
				return
			}
			gateway := []clients.ConfigSetting{
				{Key: "gateway.port", Value: float64(h.cfg.Port), Type: "number", Category: "network", Description: "Port HTTP Go Gateway", ReadOnly: true},
				{Key: "gateway.environment", Value: h.cfg.Environment, Type: "string", Category: "general", Description: "Environnement gateway", ReadOnly: true},
				{Key: "gateway.version", Value: h.cfg.Version, Type: "string", Category: "general", Description: "Version du gateway", ReadOnly: true},
				{Key: "gateway.brain_base_url", Value: h.cfg.BrainBaseURL, Type: "string", Category: "network", Description: "URL brain Python", ReadOnly: true},
				{Key: "gateway.web_url", Value: h.cfg.WebURL, Type: "string", Category: "network", Description: "URL frontend web", ReadOnly: true},
				{Key: "gateway.proactive_cron_hour", Value: float64(h.cfg.ProactiveCronHour), Type: "number", Category: "scheduler", Description: "Heure curateur nocturne (UTC)", ReadOnly: true},
			}
			out.Settings = append(gateway, out.Settings...)
			writeJSON(w, http.StatusOK, out)
		case http.MethodPut, http.MethodPost:
			writeJSON(w, http.StatusNotImplemented, map[string]any{
				"error":   "mutation runtime de la configuration non supportee",
				"message": "Redemarrer les services pour appliquer les changements de config.",
			})
		default:
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		}
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "config route not found"})
	}
}

type SystemHandlersPlus struct {
	cfg    config.Config
	system system.Handlers
}

func NewSystemHandlersPlus(cfg config.Config, base system.Handlers) *SystemHandlersPlus {
	return &SystemHandlersPlus{cfg: cfg, system: base}
}

func (h *SystemHandlersPlus) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/system")
	if path == "" {
		path = "/"
	}
	segments := strings.Split(strings.Trim(path, "/"), "/")

	switch {
	case len(segments) == 2 && segments[0] == "services" && segments[1] == "restart" && r.Method == http.MethodPost:
		var payload clients.ServiceRestartRequest
		_ = json.NewDecoder(r.Body).Decode(&payload)
		if payload.ServiceName == "" {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": "serviceName manquant"})
			return
		}
		writeJSON(w, http.StatusOK, clients.ServiceRestartResponse{
			ServiceName: payload.ServiceName,
			Status:      "planned",
			Message:     fmt.Sprintf("Redemarrage programme pour %s (non implemente en runtime). Relancer manuellement le service.", payload.ServiceName),
			RestartedAt: nowRFC3339(),
		})
	case len(segments) == 2 && segments[0] == "services" && segments[1] == "logs" && r.Method == http.MethodGet:
		lines := []string{}
		raw := r.URL.Query().Get("service")
		lines = append(lines, fmt.Sprintf("[%s] tail -n 50 logs (simulation) service=%s", nowRFC3339(), raw))
		lines = append(lines, "INFO healthcheck ok")
		lines = append(lines, "INFO request processed in 42ms")
		writeJSON(w, http.StatusOK, map[string]any{
			"service":     raw,
			"lines":       lines,
			"generatedAt": nowRFC3339(),
		})
	default:
		switch {
		case len(segments) == 1 && segments[0] == "services":
			h.system.HandleServices(w, r)
		case len(segments) == 1 && segments[0] == "status":
			h.system.HandleSystemStatus(w, r)
		default:
			writeJSON(w, http.StatusNotFound, map[string]any{"error": "system route not found: " + r.URL.Path})
		}
	}
}

var _ = url.PathEscape
