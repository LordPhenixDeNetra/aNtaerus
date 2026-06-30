package httpapi

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/gen/audiopb"
)

func TestVoiceEndToEndLatencyBudget(t *testing.T) {
	if os.Getenv("ANTAERUS_RUN_LOCAL_BENCH") != "1" {
		t.Skip("set ANTAERUS_RUN_LOCAL_BENCH=1 to run local latency budgets")
	}

	cfg := websocketTestConfig()
	threshold := 1000 * time.Millisecond

	brainServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = writer.Write([]byte("event: token\ndata: {\"text\":\"Salut\",\"sessionId\":\"latency-session\"}\n\n"))
		_, _ = writer.Write([]byte("event: complete\ndata: {\"text\":\"Salut depuis le bench voix\",\"sessionId\":\"latency-session\"}\n\n"))
	}))
	defer brainServer.Close()
	cfg.BrainBaseURL = brainServer.URL

	runtime := &fakeVoiceRuntimeClient{
		startEvents: []*audiopb.VoiceEvent{
			{
				SessionId: "latency-session",
				Payload: &audiopb.VoiceEvent_Vad{
					Vad: &audiopb.VadEvent{Speaking: true},
				},
			},
			{
				SessionId: "latency-session",
				Payload: &audiopb.VoiceEvent_Transcript{
					Transcript: &audiopb.TranscriptEvent{Text: "Bonjour", IsFinal: true},
				},
			},
		},
		holdOpen: true,
	}

	server := newWebSocketTestServerWithVoiceRuntime(t, cfg, runtime)
	defer server.Close()

	connection := dialWebSocket(t, cfg, server.URL)
	defer connection.Close()

	connection.SetReadDeadline(time.Now().Add(5 * time.Second))
	startedAt := time.Now()
	if err := connection.WriteJSON(contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageVoiceStart),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.SessionControlPayload{SessionID: "latency-session"}),
	}); err != nil {
		t.Fatalf("expected voice.start write to succeed, got error: %v", err)
	}

	receivedComplete := false
	for !receivedComplete {
		var response contracts.ServerMessage
		if err := connection.ReadJSON(&response); err != nil {
			t.Fatalf("expected voice latency response, got error: %v", err)
		}
		if response.Type == string(contracts.ServerMessageChatComplete) {
			receivedComplete = true
		}
	}

	waitForCondition(t, 5*time.Second, func() bool {
		return len(runtime.speakInvocations()) == 1
	})

	elapsed := time.Since(startedAt)
	t.Logf("voice e2e gateway latency: %s", elapsed)

	if elapsed >= threshold {
		t.Fatalf("voice end-to-end latency = %s, want < %s", elapsed, threshold)
	}
}
