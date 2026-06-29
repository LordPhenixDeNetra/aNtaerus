package system

import (
	"context"
	"net/http"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
)

type HealthService struct {
	config       config.Config
	httpClient   *http.Client
	engineClient clients.EngineRuntimeClient
}

func NewHealthService(cfg config.Config, httpClient *http.Client) HealthService {
	client := httpClient
	if client == nil {
		client = &http.Client{
			Timeout: cfg.RequestTimeout,
		}
	}

	return HealthService{
		config:       cfg,
		httpClient:   client,
		engineClient: clients.NewEngineRuntimeClient(client, cfg.EngineHTTPURL, cfg.EngineGRPCTarget, cfg.RequestTimeout),
	}
}

func (service HealthService) GatewayHealth() clients.ServiceHealth {
	return clients.ServiceHealth{
		Name:      "gateway_go",
		Status:    "healthy",
		Version:   service.config.Version,
		Port:      service.config.Port,
		URL:       service.config.GatewayURL(),
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
		Details:   "Gateway foundation service operational",
		Source:    "local",
	}
}

func (service HealthService) Services(ctx context.Context) []clients.ServiceHealth {
	return []clients.ServiceHealth{
		{
			Name:      "web",
			Status:    "healthy",
			Version:   "0.1.0",
			Port:      5173,
			URL:       service.config.WebURL,
			CheckedAt: time.Now().UTC().Format(time.RFC3339),
			Details:   "Frontend foundation dashboard configured",
			Source:    "configured",
		},
		service.GatewayHealth(),
		clients.FetchHealth(ctx, service.httpClient, clients.NewBrainClient(service.config.BrainBaseURL)),
		service.engineClient.FetchHealth(ctx),
	}
}

func (service HealthService) Capabilities(ctx context.Context) []clients.ServiceCapabilities {
	return []clients.ServiceCapabilities{
		{
			Name:         "web",
			Version:      "0.1.0",
			Runtime:      "web",
			Capabilities: []string{"dashboard", "system-status-view", "service-observability"},
			Source:       "configured",
		},
		{
			Name:         "gateway_go",
			Version:      service.config.Version,
			Runtime:      "go",
			Capabilities: []string{"healthcheck", "service-aggregation", "http-api"},
			Source:       "local",
		},
		clients.FetchCapabilities(ctx, service.httpClient, clients.NewBrainClient(service.config.BrainBaseURL)),
		service.engineClient.FetchCapabilities(ctx),
	}
}

func (service HealthService) AggregatedHealth(ctx context.Context) clients.AggregatedHealth {
	services := service.Services(ctx)

	return clients.AggregatedHealth{
		Product:     "aNtaerus",
		Environment: service.config.Environment,
		Status:      aggregateStatus(services),
		Services:    services,
	}
}

func (service HealthService) SystemStatus(ctx context.Context) clients.SystemStatus {
	return clients.SystemStatus{
		Product:      "aNtaerus",
		Phase:        "m1.1-infra-socle",
		Environment:  service.config.Environment,
		Services:     service.Services(ctx),
		Capabilities: service.Capabilities(ctx),
	}
}

func aggregateStatus(services []clients.ServiceHealth) string {
	for _, service := range services {
		if service.Status != "healthy" {
			return "degraded"
		}
	}

	return "healthy"
}
