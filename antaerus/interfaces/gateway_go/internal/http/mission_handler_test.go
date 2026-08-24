package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/gen/audiopb"
	"antaerus/interfaces/gateway_go/internal/system"
	"google.golang.org/grpc"
)

func newTestHub(brainBaseURL string) *Hub {
	cfg := config.Config{
		Environment: "test",
		Port:        18080,
		Version:     "0.1.0",
		WebURL:      "http://localhost:5173",
		BrainBaseURL: brainBaseURL,
		RequestTimeout:     time.Second,
		ReadHeaderTimeout:  time.Second,
		ShutdownTimeout:    time.Second,
		IdleTimeout:        time.Second,
		WriteTimeout:       time.Second,
		JWTSecret:          "dev",
		JWTIssuer:          "t",
		JWTAudience:        "t",
		JWTTokenTTL:        time.Second,
		WSHeartbeat:        time.Second,
		HTTPRateLimitRPS:   100,
		HTTPRateLimitBurst: 200,
		WSConnectRateRPS:   100,
		WSConnectBurst:     200,
		WSMessageRateRPS:   100,
		WSMessageBurst:     200,
	}
	hc := &http.Client{Timeout: cfg.RequestTimeout}
	authenticator := NewAuthenticator(cfg)
	rateLimiter := NewRateLimiter(cfg)
	brainChat := clients.NewBrainChatClient(hc, cfg.BrainBaseURL, cfg.WriteTimeout)
	health := system.NewHealthService(cfg, hc)
	return NewHub(cfg, authenticator, rateLimiter, brainChat, func(ctx context.Context) (voiceRuntimeClient, error) {
		return &noopVoiceRuntime{}, nil
	}, health)
}

type noopVoiceRuntime struct{}

func (n *noopVoiceRuntime) StartVoiceSession(_ context.Context, _, _ string) (grpc.ServerStreamingClient[audiopb.VoiceEvent], error) {
	return nil, nil
}
func (n *noopVoiceRuntime) StopVoiceSession(_ context.Context, _ string) (*audiopb.StopVoiceSessionResponse, error) {
	return &audiopb.StopVoiceSessionResponse{}, nil
}
func (n *noopVoiceRuntime) Speak(_ context.Context, _, _ string) (*audiopb.SpeakResponse, error) {
	return &audiopb.SpeakResponse{}, nil
}
func (n *noopVoiceRuntime) Close() error { return nil }

type fakeBrainHandler struct {
	t *testing.T
}

func (h *fakeBrainHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch {
	case r.Method == http.MethodPost && r.URL.Path == "/missions":
		var body clients.CreateMissionRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = json.NewEncoder(w).Encode(clients.Mission{
			ID:          "m-created",
			Title:       body.UserRequest,
			UserRequest: body.UserRequest,
			Status:      "planned",
			CreatedAt:   "now",
			UpdatedAt:   "now",
		})
	case r.Method == http.MethodGet && r.URL.Path == "/missions":
		_ = json.NewEncoder(w).Encode(clients.ListMissionsResponse{
			Items: []clients.Mission{
				{ID: "m1", Status: "planned", Title: "M1", UserRequest: "u", CreatedAt: "x", UpdatedAt: "x"},
			},
			Total: 1,
		})
	case strings.HasPrefix(r.URL.Path, "/missions/m-conflict") && strings.HasSuffix(r.URL.Path, "/run"):
		http.Error(w, `{"detail":"status conflict"}`, http.StatusConflict)
	case strings.HasPrefix(r.URL.Path, "/missions/m-run") && strings.HasSuffix(r.URL.Path, "/run"):
		_ = json.NewEncoder(w).Encode(clients.Mission{
			ID: "m-run", Status: "running", Title: "T", UserRequest: "u",
			Steps: []clients.MissionStep{
				{ID: "s0", Index: 0, Title: "S0", Status: "running"},
			},
			CreatedAt: "x", UpdatedAt: "x",
		})
	default:
		http.Error(w, `{"detail":"not found in fake"}`, http.StatusNotFound)
	}
}

func TestMissionHandlersCreateAndList(t *testing.T) {
	brain := httptest.NewServer(&fakeBrainHandler{t: t})
	defer brain.Close()
	hub := newTestHub(brain.URL)
	missionClient := clients.NewBrainMissionClient(brain.Client(), brain.URL, time.Second)
	handlers := NewMissionHandlers(missionClient, hub)

	createBody := bytes.NewBufferString(`{"user_request":"cafe"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/missions", createBody)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handlers.ServeHTTP(rr, req)
	if rr.Code >= 300 {
		t.Fatalf("create: status %d body %s", rr.Code, rr.Body.String())
	}
	var created clients.Mission
	if err := json.NewDecoder(rr.Body).Decode(&created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if created.ID != "m-created" {
		t.Fatalf("unexpected id %q", created.ID)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/missions?status=planned", nil)
	listRR := httptest.NewRecorder()
	handlers.ServeHTTP(listRR, listReq)
	if listRR.Code != http.StatusOK {
		t.Fatalf("list: %d %s", listRR.Code, listRR.Body.String())
	}
	var listed clients.ListMissionsResponse
	if err := json.NewDecoder(listRR.Body).Decode(&listed); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if listed.Total != 1 {
		t.Fatalf("total %d", listed.Total)
	}
}

func TestMissionHandlersRunConflict(t *testing.T) {
	brain := httptest.NewServer(&fakeBrainHandler{t: t})
	defer brain.Close()
	hub := newTestHub(brain.URL)
	missionClient := clients.NewBrainMissionClient(brain.Client(), brain.URL, time.Second)
	handlers := NewMissionHandlers(missionClient, hub)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/missions/m-conflict/run", nil)
	rr := httptest.NewRecorder()
	handlers.ServeHTTP(rr, req)
	if rr.Code != http.StatusConflict {
		t.Fatalf("expected 409 got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestMissionHandlersRunBroadcastsWS(t *testing.T) {
	brain := httptest.NewServer(&fakeBrainHandler{t: t})
	defer brain.Close()
	hub := newTestHub(brain.URL)
	missionClient := clients.NewBrainMissionClient(brain.Client(), brain.URL, time.Second)
	handlers := NewMissionHandlers(missionClient, hub)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/missions/m-run/run", nil)
	rr := httptest.NewRecorder()
	handlers.ServeHTTP(rr, req)
	if rr.Code != http.StatusAccepted {
		t.Fatalf("expected 202 got %d: %s", rr.Code, rr.Body.String())
	}
	timeout := time.After(1 * time.Second)
	gotBroadcast := false
	ticker := time.NewTicker(30 * time.Millisecond)
	defer ticker.Stop()
loop:
	for !gotBroadcast {
		select {
		case <-timeout:
			t.Fatalf("timeout waiting mission.update broadcast")
		case msg := <-hub.broadcast:
			if msg.Type == string(contracts.ServerMessageMissionUpdate) {
				gotBroadcast = true
				break loop
			}
		case <-ticker.C:
		}
	}
	if !gotBroadcast {
		t.Fatalf("no mission.update broadcast received")
	}
}
