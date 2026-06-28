package bench

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
)

func TestHTTPLatencyBudget(t *testing.T) {
	if os.Getenv("ANTAERUS_RUN_LOCAL_BENCH") != "1" {
		t.Skip("set ANTAERUS_RUN_LOCAL_BENCH=1 to run local latency budgets")
	}

	baseURL := envOrDefault("ANTAERUS_BRAIN_URL", "http://127.0.0.1:8000")
	threshold := 50 * time.Millisecond
	httpClient := &http.Client{Timeout: 2 * time.Second}

	const warmupRequests = 5
	const measuredRequests = 25

	for i := 0; i < warmupRequests; i++ {
		if _, err := fetchHealth(httpClient, baseURL); err != nil {
			t.Fatalf("fetchHealth() warmup error = %v", err)
		}
	}

	var total time.Duration

	for i := 0; i < measuredRequests; i++ {
		startedAt := time.Now()
		health, err := fetchHealth(httpClient, baseURL)
		if err != nil {
			t.Fatalf("fetchHealth() error = %v", err)
		}
		if health.Status != "healthy" {
			t.Fatalf("health.Status = %q, want %q", health.Status, "healthy")
		}
		total += time.Since(startedAt)
	}

	average := total / measuredRequests
	t.Logf("HTTP Go<->Python average latency: %s", average)

	if average >= threshold {
		t.Fatalf("average latency = %s, want < %s", average, threshold)
	}
}

func fetchHealth(httpClient *http.Client, baseURL string) (clients.ServiceHealth, error) {
	response, err := httpClient.Get(baseURL + "/health")
	if err != nil {
		return clients.ServiceHealth{}, err
	}
	defer closeResponseBody(response)

	var health clients.ServiceHealth
	if err := json.NewDecoder(response.Body).Decode(&health); err != nil {
		return clients.ServiceHealth{}, err
	}

	return health, nil
}

func closeResponseBody(response *http.Response) {
	if response == nil || response.Body == nil {
		return
	}

	_ = response.Body.Close()
}
