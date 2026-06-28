package bench

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
)

func TestGRPCLatencyBudget(t *testing.T) {
	if os.Getenv("ANTAERUS_RUN_LOCAL_BENCH") != "1" {
		t.Skip("set ANTAERUS_RUN_LOCAL_BENCH=1 to run local latency budgets")
	}

	target := envOrDefault("ANTAERUS_ENGINE_GRPC_ADDRESS", "127.0.0.1:7001")
	threshold := 10 * time.Millisecond

	connectCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	client, err := clients.NewEngineGRPCClient(connectCtx, target)
	if err != nil {
		t.Fatalf("NewEngineGRPCClient() error = %v", err)
	}
	defer func() {
		_ = client.Close()
	}()

	if _, err := client.GetHealth(context.Background()); err != nil {
		t.Fatalf("GetHealth() error = %v", err)
	}

	if _, err := client.GetCapabilities(context.Background()); err != nil {
		t.Fatalf("GetCapabilities() error = %v", err)
	}

	const warmupRequests = 5
	const measuredRequests = 25

	for i := 0; i < warmupRequests; i++ {
		if _, err := client.Ping(context.Background(), fmt.Sprintf("warmup-%d", i)); err != nil {
			t.Fatalf("Ping() warmup error = %v", err)
		}
	}

	var total time.Duration

	for i := 0; i < measuredRequests; i++ {
		startedAt := time.Now()
		response, err := client.Ping(context.Background(), fmt.Sprintf("measure-%d", i))
		if err != nil {
			t.Fatalf("Ping() error = %v", err)
		}
		if response.GetRequestId() != fmt.Sprintf("measure-%d", i) {
			t.Fatalf("Ping() request_id = %q, want %q", response.GetRequestId(), fmt.Sprintf("measure-%d", i))
		}
		total += time.Since(startedAt)
	}

	average := total / measuredRequests
	t.Logf("gRPC Go<->Rust average latency: %s", average)

	if average >= threshold {
		t.Fatalf("average latency = %s, want < %s", average, threshold)
	}
}

func envOrDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}
