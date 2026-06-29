package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/system"
	"github.com/gorilla/websocket"
)

func TestWebSocketRejectsMissingToken(t *testing.T) {
	server := newWebSocketTestServer(t, websocketTestConfig())
	defer server.Close()

	_, response, err := websocket.DefaultDialer.Dial(websocketURL(server.URL, "/api/v1/ws"), nil)
	if err == nil {
		t.Fatal("expected missing token handshake to fail")
	}

	if response == nil || response.StatusCode != 401 {
		t.Fatalf("expected 401 handshake rejection, got %#v", response)
	}
}

func TestWebSocketHandlesChatMessage(t *testing.T) {
	cfg := websocketTestConfig()
	brainServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/llm/session-stream" {
			t.Fatalf("unexpected brain path %s", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = writer.Write([]byte("event: token\ndata: {\"text\":\"Bon\",\"sessionId\":\"session-1\"}\n\n"))
		_, _ = writer.Write([]byte("event: complete\ndata: {\"text\":\"Bonjour\",\"sessionId\":\"session-1\"}\n\n"))
	}))
	defer brainServer.Close()
	cfg.BrainBaseURL = brainServer.URL
	server := newWebSocketTestServer(t, cfg)
	defer server.Close()

	auth := NewAuthenticator(cfg)
	token, err := auth.IssueToken("user-123", "user")
	if err != nil {
		t.Fatalf("expected JWT issuance to succeed, got error: %v", err)
	}

	connection, _, err := websocket.DefaultDialer.Dial(websocketURL(server.URL, "/api/v1/ws?token="+token), nil)
	if err != nil {
		t.Fatalf("expected WebSocket handshake to succeed, got error: %v", err)
	}
	defer connection.Close()

	connection.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	if err := connection.WriteJSON(contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageChat),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.ChatMessagePayload{
			SessionID: "session-1",
			Message:   "Bonjour",
		}),
	}); err != nil {
		t.Fatalf("expected chat message write to succeed, got error: %v", err)
	}

	var tokenResponse contracts.ServerMessage
	if err := connection.ReadJSON(&tokenResponse); err != nil {
		t.Fatalf("expected token response, got error: %v", err)
	}
	if tokenResponse.Type != string(contracts.ServerMessageChatToken) {
		t.Fatalf("expected chat.token, got %q", tokenResponse.Type)
	}

	var response contracts.ServerMessage
	if err := connection.ReadJSON(&response); err != nil {
		t.Fatalf("expected chat complete response, got error: %v", err)
	}

	if response.Type != string(contracts.ServerMessageChatComplete) {
		t.Fatalf("expected chat.complete, got %q", response.Type)
	}
}

func TestWebSocketMessageRateLimitSendsAlert(t *testing.T) {
	cfg := websocketTestConfig()
	cfg.WSMessageBurst = 1
	cfg.WSMessageRateRPS = 100

	server := newWebSocketTestServer(t, cfg)
	defer server.Close()

	auth := NewAuthenticator(cfg)
	token, err := auth.IssueToken("user-123", "user")
	if err != nil {
		t.Fatalf("expected JWT issuance to succeed, got error: %v", err)
	}

	connection, _, err := websocket.DefaultDialer.Dial(websocketURL(server.URL, "/api/v1/ws?token="+token), nil)
	if err != nil {
		t.Fatalf("expected WebSocket handshake to succeed, got error: %v", err)
	}
	defer connection.Close()

	connection.SetReadDeadline(time.Now().Add(time.Second))
	first := contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageVoiceStart),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.SessionControlPayload{SessionID: "session-1"}),
	}

	if err := connection.WriteJSON(first); err != nil {
		t.Fatalf("expected first WS message to succeed, got error: %v", err)
	}
	if err := connection.WriteJSON(first); err != nil {
		t.Fatalf("expected second WS message write to succeed, got error: %v", err)
	}

	var firstResponse contracts.ServerMessage
	if err := connection.ReadJSON(&firstResponse); err != nil {
		t.Fatalf("expected first WS response, got error: %v", err)
	}

	var secondResponse contracts.ServerMessage
	if err := connection.ReadJSON(&secondResponse); err != nil {
		t.Fatalf("expected second WS response, got error: %v", err)
	}

	if secondResponse.Type != string(contracts.ServerMessageSystemAlert) {
		t.Fatalf("expected system.alert for rate limit, got %q", secondResponse.Type)
	}

	var payload contracts.SystemAlertPayload
	if err := json.Unmarshal(secondResponse.Payload, &payload); err != nil {
		t.Fatalf("expected valid alert payload, got error: %v", err)
	}

	if !strings.Contains(payload.Message, "rate limit") {
		t.Fatalf("expected rate limit alert message, got %q", payload.Message)
	}
}

func newWebSocketTestServer(t *testing.T, cfg config.Config) *httptest.Server {
	t.Helper()
	return httptest.NewServer(NewMux(cfg, system.NewHandlers(cfg)))
}

func websocketTestConfig() config.Config {
	return newTestAuthenticator().config
}

func websocketURL(serverURL string, path string) string {
	return "ws" + strings.TrimPrefix(serverURL, "http") + path
}

func mustMarshalRaw(t *testing.T, payload any) json.RawMessage {
	t.Helper()

	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("expected payload marshaling to succeed, got error: %v", err)
	}

	return raw
}
