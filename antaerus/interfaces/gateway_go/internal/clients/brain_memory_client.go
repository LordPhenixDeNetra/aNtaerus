package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var ErrMemoryNotFound = errors.New("memory resource not found")

type ServiceRestartRequest struct {
	ServiceName string `json:"serviceName"`
}

type ServiceRestartResponse struct {
	ServiceName string `json:"serviceName"`
	Status      string `json:"status"`
	Message     string `json:"message"`
	RestartedAt string `json:"restartedAt"`
}

type FactRecord struct {
	ID            string  `json:"id"`
	Subject       string  `json:"subject"`
	Predicate     string  `json:"predicate"`
	Object        string  `json:"object"`
	Category      string  `json:"category"`
	Confidence    float64 `json:"confidence"`
	Status        string  `json:"status"`
	SourceEventID *string `json:"source_event_id"`
	FactID        *string `json:"fact_id,omitempty"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

type FactRelation struct {
	ID            string `json:"id"`
	FactID        string `json:"fact_id"`
	RelatedFactID string `json:"related_fact_id"`
	RelationType  string `json:"relation_type"`
	CreatedAt     string `json:"created_at"`
}

type FactGraphResponse struct {
	Facts     []FactRecord   `json:"facts"`
	Relations []FactRelation `json:"relations"`
}

type AnalyticsMetricPoint struct {
	Timestamp string  `json:"timestamp"`
	Value     float64 `json:"value"`
}

type AnalyticsSeries struct {
	Name   string                 `json:"name"`
	Points []AnalyticsMetricPoint `json:"points"`
}

type AnalyticsSummary struct {
	TotalTokensSpent       int64             `json:"totalTokensSpent"`
	TotalMessagesProcessed int64             `json:"totalMessagesProcessed"`
	TotalMissionsCompleted int64             `json:"totalMissionsCompleted"`
	TotalInitiativesRun    int64             `json:"totalInitiativesRun"`
	AverageLatencyMs       float64           `json:"averageLatencyMs"`
	EstimatedCostUsd       float64           `json:"estimatedCostUsd"`
	Series                 []AnalyticsSeries `json:"series"`
}

type ConfigSetting struct {
	Key          string      `json:"key"`
	Value        interface{} `json:"value"`
	DefaultValue interface{} `json:"defaultValue,omitempty"`
	Description  string      `json:"description,omitempty"`
	Type         string      `json:"type"`
	Category     string      `json:"category"`
	ReadOnly     bool        `json:"readOnly,omitempty"`
}

type ConfigSnapshot struct {
	GeneratedAt string          `json:"generatedAt"`
	Version     string          `json:"version"`
	Environment string          `json:"environment"`
	Settings    []ConfigSetting `json:"settings"`
}

type BrainMemoryClient struct {
	httpClient *http.Client
	baseURL    string
	timeout    time.Duration
}

func NewBrainMemoryClient(httpClient *http.Client, baseURL string, timeout time.Duration) BrainMemoryClient {
	client := httpClient
	if client == nil {
		client = &http.Client{Timeout: timeout}
	}
	return BrainMemoryClient{
		httpClient: client,
		baseURL:    strings.TrimRight(baseURL, "/"),
		timeout:    timeout,
	}
}

func (c BrainMemoryClient) Request(ctx context.Context, method, path string, body interface{}, out interface{}) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal memory request: %w", err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return fmt.Errorf("build memory request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	response, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("memory request %s: %w", path, err)
	}
	defer response.Body.Close()
	if out == nil {
		return nil
	}
	if response.StatusCode >= 400 {
		raw, _ := io.ReadAll(response.Body)
		return fmt.Errorf("memory request %s failed (%d): %s", path, response.StatusCode, string(raw))
	}
	if err := json.NewDecoder(response.Body).Decode(out); err != nil {
		return fmt.Errorf("decode memory response: %w", err)
	}
	return nil
}

func (c BrainMemoryClient) ListFacts(ctx context.Context, query string, limit int) ([]FactRecord, error) {
	u, _ := url.Parse(c.baseURL + "/memory/facts")
	q := u.Query()
	if query != "" {
		q.Set("query", query)
	}
	if limit > 0 {
		q.Set("limit", fmt.Sprintf("%d", limit))
	}
	u.RawQuery = q.Encode()
	var out struct {
		Facts []FactRecord `json:"facts"`
	}
	if err := c.Request(ctx, http.MethodGet, u.RequestURI(), nil, &out); err != nil {
		return nil, err
	}
	return out.Facts, nil
}

func (c BrainMemoryClient) UpsertFact(ctx context.Context, fact FactRecord) (FactRecord, error) {
	var out struct {
		Fact FactRecord `json:"fact"`
	}
	if err := c.Request(ctx, http.MethodPost, "/memory/facts", fact, &out); err != nil {
		return FactRecord{}, err
	}
	return out.Fact, nil
}

func (c BrainMemoryClient) Graph(ctx context.Context) (FactGraphResponse, error) {
	var out FactGraphResponse
	if err := c.Request(ctx, http.MethodGet, "/memory/graph", nil, &out); err != nil {
		return FactGraphResponse{}, err
	}
	return out, nil
}
