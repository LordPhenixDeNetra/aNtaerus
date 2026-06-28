package clients

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ServiceHealth struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	Version   string `json:"version"`
	Port      int    `json:"port"`
	URL       string `json:"url"`
	CheckedAt string `json:"checkedAt"`
	Details   string `json:"details,omitempty"`
}

type ServiceCapabilities struct {
	Name         string   `json:"name"`
	Version      string   `json:"version"`
	Runtime      string   `json:"runtime"`
	Capabilities []string `json:"capabilities"`
}

type SystemStatus struct {
	Product      string                `json:"product"`
	Phase        string                `json:"phase"`
	Environment  string                `json:"environment"`
	Services     []ServiceHealth       `json:"services"`
	Capabilities []ServiceCapabilities `json:"capabilities"`
}

type ServiceClient struct {
	Name            string
	Runtime         string
	BaseURL         string
	HealthPath      string
	CapabilitiesPath string
}

func NewPythonClient(baseURL string) ServiceClient {
	return ServiceClient{
		Name:             "brain_python",
		Runtime:          "python",
		BaseURL:          baseURL,
		HealthPath:       "/health",
		CapabilitiesPath: "/internal/capabilities",
	}
}

func FetchHealth(ctx context.Context, client *http.Client, service ServiceClient) ServiceHealth {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, service.BaseURL+service.HealthPath, nil)
	if err != nil {
		return offlineHealth(service, err)
	}

	response, err := client.Do(request)
	if err != nil {
		return offlineHealth(service, err)
	}
	defer response.Body.Close()

	var payload ServiceHealth
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return offlineHealth(service, err)
	}

	return payload
}

func FetchCapabilities(ctx context.Context, client *http.Client, service ServiceClient) ServiceCapabilities {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, service.BaseURL+service.CapabilitiesPath, nil)
	if err != nil {
		return offlineCapabilities(service)
	}

	response, err := client.Do(request)
	if err != nil {
		return offlineCapabilities(service)
	}
	defer response.Body.Close()

	var payload ServiceCapabilities
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return offlineCapabilities(service)
	}

	return payload
}

func offlineHealth(service ServiceClient, err error) ServiceHealth {
	return ServiceHealth{
		Name:      service.Name,
		Status:    "offline",
		Version:   "unknown",
		Port:      0,
		URL:       service.BaseURL,
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
		Details:   fmt.Sprintf("unreachable: %v", err),
	}
}

func offlineCapabilities(service ServiceClient) ServiceCapabilities {
	return ServiceCapabilities{
		Name:         service.Name,
		Version:      "unknown",
		Runtime:      service.Runtime,
		Capabilities: []string{},
	}
}

