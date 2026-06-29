package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
)

func TestChatHistoryHandlerReturnsBrainHistory(t *testing.T) {
	brainServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/memory/chat/sessions/session-1" {
			t.Fatalf("unexpected path %s", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"sessionId":"session-1","messages":[{"id":"msg-1","sessionId":"session-1","role":"user","content":"Bonjour","createdAt":"2026-01-01T00:00:00Z"}]}`))
	}))
	defer brainServer.Close()

	handler := NewChatHistoryHandler(
		clients.NewBrainChatClient(brainServer.Client(), brainServer.URL, time.Second),
	)
	request := httptest.NewRequest(http.MethodGet, "/api/v1/chat/sessions/session-1", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if body := recorder.Body.String(); body == "" {
		t.Fatal("expected non-empty body")
	}
}
