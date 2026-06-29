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
	Source    string `json:"source,omitempty"`
}

type ServiceCapabilities struct {
	Name         string   `json:"name"`
	Version      string   `json:"version"`
	Runtime      string   `json:"runtime"`
	Capabilities []string `json:"capabilities"`
	Source       string   `json:"source,omitempty"`
}

type AggregatedHealth struct {
	Product     string          `json:"product"`
	Environment string          `json:"environment"`
	Status      string          `json:"status"`
	Services    []ServiceHealth `json:"services"`
}

type SystemStatus struct {
	Product      string                `json:"product"`
	Phase        string                `json:"phase"`
	Environment  string                `json:"environment"`
	Services     []ServiceHealth       `json:"services"`
	Capabilities []ServiceCapabilities `json:"capabilities"`
}

type ServiceClient struct {
	Name             string
	Runtime          string
	BaseURL          string
	HealthPath       string
	CapabilitiesPath string
}

func NewPythonClient(baseURL string) ServiceClient {
	return NewBrainClient(baseURL)
}

func NewBrainClient(baseURL string) ServiceClient {
	return ServiceClient{
		Name:             "brain_python",
		Runtime:          "python",
		BaseURL:          baseURL,
		HealthPath:       "/health",
		CapabilitiesPath: "/internal/capabilities",
	}
}

func FetchHealth(ctx context.Context, client httpClient, service ServiceClient) ServiceHealth {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, service.BaseURL+service.HealthPath, nil)
	if err != nil {
		return offlineHealth(service, err)
	}

	response, err := client.Do(request)
	if err != nil {
		return offlineHealth(service, err)
	}
	defer closeBody(response)

	if response.StatusCode != http.StatusOK {
		return offlineHealth(service, fmt.Errorf("unexpected status code %d", response.StatusCode))
	}

	var payload ServiceHealth
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return offlineHealth(service, err)
	}

	if payload.Name == "" {
		payload.Name = service.Name
	}

	if payload.Source == "" {
		payload.Source = "http"
	}

	return payload
}

func FetchCapabilities(ctx context.Context, client httpClient, service ServiceClient) ServiceCapabilities {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, service.BaseURL+service.CapabilitiesPath, nil)
	if err != nil {
		return offlineCapabilities(service)
	}

	response, err := client.Do(request)
	if err != nil {
		return offlineCapabilities(service)
	}
	defer closeBody(response)

	if response.StatusCode != http.StatusOK {
		return offlineCapabilities(service)
	}

	var payload ServiceCapabilities
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return offlineCapabilities(service)
	}

	if payload.Name == "" {
		payload.Name = service.Name
	}

	if payload.Runtime == "" {
		payload.Runtime = service.Runtime
	}

	if payload.Source == "" {
		payload.Source = "http"
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
		Source:    "offline",
	}
}

func offlineCapabilities(service ServiceClient) ServiceCapabilities {
	return ServiceCapabilities{
		Name:         service.Name,
		Version:      "unknown",
		Runtime:      service.Runtime,
		Capabilities: []string{},
		Source:       "offline",
	}
}

func closeBody(response *http.Response) {
	if response == nil || response.Body == nil {
		return
	}

	_ = response.Body.Close()
}
