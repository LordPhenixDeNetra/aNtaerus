package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/gen/audiopb"
	"antaerus/interfaces/gateway_go/internal/system"
	"github.com/gorilla/websocket"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
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
	runtime := &fakeVoiceRuntimeClient{
		holdOpen: true,
		startEvents: []*audiopb.VoiceEvent{
			{
				SessionId: "session-1",
				Payload: &audiopb.VoiceEvent_System{
					System: &audiopb.SystemEvent{Level: "info", Message: "voice session started"},
				},
			},
		},
	}

	server := newWebSocketTestServerWithVoiceRuntime(t, cfg, runtime)
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

	for _, response := range []contracts.ServerMessage{firstResponse, secondResponse} {
		if response.Type != string(contracts.ServerMessageSystemAlert) {
			continue
		}

		var payload contracts.SystemAlertPayload
		if err := json.Unmarshal(response.Payload, &payload); err != nil {
			t.Fatalf("expected valid alert payload, got error: %v", err)
		}
		if strings.Contains(payload.Message, "rate limit") {
			return
		}
	}
	t.Fatal("expected one WS response to contain a rate limit alert")
}

func TestWebSocketVoiceStartOpensRuntimeSession(t *testing.T) {
	cfg := websocketTestConfig()
	runtime := &fakeVoiceRuntimeClient{holdOpen: true}
	server := newWebSocketTestServerWithVoiceRuntime(t, cfg, runtime)
	defer server.Close()

	connection := dialWebSocket(t, cfg, server.URL)
	defer connection.Close()

	if err := connection.WriteJSON(contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageVoiceStart),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.SessionControlPayload{SessionID: "session-1"}),
	}); err != nil {
		t.Fatalf("expected voice.start write to succeed, got error: %v", err)
	}

	waitForCondition(t, time.Second, func() bool {
		return len(runtime.startInvocations()) == 1
	})

	starts := runtime.startInvocations()
	if starts[0].SessionID != "session-1" {
		t.Fatalf("expected runtime start session to be session-1, got %q", starts[0].SessionID)
	}
	if starts[0].Language != defaultVoiceLanguage {
		t.Fatalf("expected runtime language to be %q, got %q", defaultVoiceLanguage, starts[0].Language)
	}
}

func TestForwardVoiceEventStreamsTranscriptAndSpeaks(t *testing.T) {
	cfg := websocketTestConfig()
	brainServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/llm/session-stream" {
			t.Fatalf("unexpected brain path %s", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = writer.Write([]byte("event: token\ndata: {\"text\":\"Salut\",\"sessionId\":\"session-1\"}\n\n"))
		_, _ = writer.Write([]byte("event: complete\ndata: {\"text\":\"Salut depuis le LLM\",\"sessionId\":\"session-1\"}\n\n"))
	}))
	defer brainServer.Close()

	brainChat := clients.NewBrainChatClient(&http.Client{Timeout: time.Second}, brainServer.URL, time.Second)
	hub := &Hub{
		config:        cfg,
		brainChat:     brainChat,
		voiceSessions: map[string]*voiceSession{},
	}
	client := &Client{
		id:   "user-1",
		send: make(chan contracts.ServerMessage, 8),
		done: make(chan struct{}),
	}
	runtime := &fakeVoiceRuntimeClient{}
	sessionCtx, cancel := context.WithCancel(context.Background())
	defer cancel()
	session := &voiceSession{
		key:       "user-1:session-1",
		client:    client,
		sessionID: "session-1",
		language:  defaultVoiceLanguage,
		runtime:   runtime,
		ctx:       sessionCtx,
		cancel:    cancel,
	}

	hub.forwardVoiceEvent(session, &audiopb.VoiceEvent{
		SessionId: "session-1",
		Payload: &audiopb.VoiceEvent_Vad{
			Vad: &audiopb.VadEvent{Speaking: true},
		},
	})
	hub.forwardVoiceEvent(session, &audiopb.VoiceEvent{
		SessionId: "session-1",
		Payload: &audiopb.VoiceEvent_Transcript{
			Transcript: &audiopb.TranscriptEvent{Text: "Bonjour", IsFinal: true},
		},
	})

	waitForCondition(t, time.Second, func() bool {
		return len(runtime.speakInvocations()) == 1
	})

	types := make([]string, 0, 4)
	for len(types) < 4 {
		select {
		case message := <-client.send:
			types = append(types, message.Type)
		default:
			t.Fatal("expected queued proxy messages")
		}
	}

	expected := []string{
		string(contracts.ServerMessageVoiceVADState),
		string(contracts.ServerMessageVoiceTranscript),
		string(contracts.ServerMessageChatToken),
		string(contracts.ServerMessageChatComplete),
	}
	for index, responseType := range expected {
		if types[index] != responseType {
			t.Fatalf("expected queued message %d to be %q, got %q", index, responseType, types[index])
		}
	}

	speaks := runtime.speakInvocations()
	if speaks[0].SessionID != "session-1" {
		t.Fatalf("expected speak session to be session-1, got %q", speaks[0].SessionID)
	}
	if speaks[0].Text != "Salut depuis le LLM" {
		t.Fatalf("expected speak text to be final LLM text, got %q", speaks[0].Text)
	}
}

func TestWebSocketVoiceStopStopsRuntimeSession(t *testing.T) {
	cfg := websocketTestConfig()
	runtime := &fakeVoiceRuntimeClient{holdOpen: true}
	server := newWebSocketTestServerWithVoiceRuntime(t, cfg, runtime)
	defer server.Close()

	connection := dialWebSocket(t, cfg, server.URL)
	defer connection.Close()

	if err := connection.WriteJSON(contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageVoiceStart),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.SessionControlPayload{SessionID: "session-1"}),
	}); err != nil {
		t.Fatalf("expected voice.start write to succeed, got error: %v", err)
	}

	waitForCondition(t, time.Second, func() bool {
		return len(runtime.startInvocations()) == 1
	})

	if err := connection.WriteJSON(contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageVoiceStop),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.SessionControlPayload{SessionID: "session-1"}),
	}); err != nil {
		t.Fatalf("expected voice.stop write to succeed, got error: %v", err)
	}

	waitForCondition(t, time.Second, func() bool {
		return len(runtime.stopInvocations()) == 1
	})

	stops := runtime.stopInvocations()
	if stops[0] != "session-1" {
		t.Fatalf("expected stop session to be session-1, got %q", stops[0])
	}
}

func TestWebSocketVoiceBargeInRestartsRuntimeSession(t *testing.T) {
	cfg := websocketTestConfig()
	runtime := &fakeVoiceRuntimeClient{holdOpen: true}
	server := newWebSocketTestServerWithVoiceRuntime(t, cfg, runtime)
	defer server.Close()

	connection := dialWebSocket(t, cfg, server.URL)
	defer connection.Close()

	if err := connection.WriteJSON(contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageVoiceStart),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.SessionControlPayload{SessionID: "session-1"}),
	}); err != nil {
		t.Fatalf("expected voice.start write to succeed, got error: %v", err)
	}

	waitForCondition(t, time.Second, func() bool {
		return len(runtime.startInvocations()) == 1
	})

	if err := connection.WriteJSON(contracts.ClientMessage{
		Envelope: contracts.Envelope{
			Type:      string(contracts.ClientMessageBargeIn),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: mustMarshalRaw(t, contracts.SessionControlPayload{SessionID: "session-1"}),
	}); err != nil {
		t.Fatalf("expected voice.barge_in write to succeed, got error: %v", err)
	}

	waitForCondition(t, time.Second, func() bool {
		return len(runtime.stopInvocations()) == 1 && len(runtime.startInvocations()) == 2
	})
}

func newWebSocketTestServer(t *testing.T, cfg config.Config) *httptest.Server {
	t.Helper()
	return newWebSocketTestServerWithVoiceRuntime(t, cfg, &fakeVoiceRuntimeClient{})
}

func newWebSocketTestServerWithVoiceRuntime(
	t *testing.T,
	cfg config.Config,
	runtime *fakeVoiceRuntimeClient,
) *httptest.Server {
	t.Helper()
	return httptest.NewServer(newMux(
		cfg,
		system.NewHandlers(cfg),
		func(context.Context) (voiceRuntimeClient, error) {
			return runtime, nil
		},
	))
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

func dialWebSocket(t *testing.T, cfg config.Config, serverURL string) *websocket.Conn {
	t.Helper()
	auth := NewAuthenticator(cfg)
	token, err := auth.IssueToken("user-123", "user")
	if err != nil {
		t.Fatalf("expected JWT issuance to succeed, got error: %v", err)
	}

	connection, _, err := websocket.DefaultDialer.Dial(websocketURL(serverURL, "/api/v1/ws?token="+token), nil)
	if err != nil {
		t.Fatalf("expected WebSocket handshake to succeed, got error: %v", err)
	}
	return connection
}

func waitForCondition(t *testing.T, timeout time.Duration, condition func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("condition not reached before timeout")
}

type fakeVoiceStartInvocation struct {
	SessionID string
	Language  string
}

type fakeSpeakInvocation struct {
	SessionID string
	Text      string
}

type fakeVoiceRuntimeClient struct {
	mu sync.Mutex

	startEvents []*audiopb.VoiceEvent
	startErr    error
	stopErr     error
	speakErr    error
	holdOpen    bool

	startCalls []fakeVoiceStartInvocation
	stopCalls  []string
	speakCalls []fakeSpeakInvocation
}

func (client *fakeVoiceRuntimeClient) StartVoiceSession(
	ctx context.Context,
	sessionID string,
	language string,
) (grpcStream grpc.ServerStreamingClient[audiopb.VoiceEvent], err error) {
	client.mu.Lock()
	client.startCalls = append(client.startCalls, fakeVoiceStartInvocation{
		SessionID: sessionID,
		Language:  language,
	})
	events := append([]*audiopb.VoiceEvent(nil), client.startEvents...)
	startErr := client.startErr
	client.mu.Unlock()

	if startErr != nil {
		return nil, startErr
	}

	return &fakeVoiceStream{
		ctx:      ctx,
		events:   events,
		holdOpen: client.holdOpen,
	}, nil
}

func (client *fakeVoiceRuntimeClient) StopVoiceSession(
	_ context.Context,
	sessionID string,
) (*audiopb.StopVoiceSessionResponse, error) {
	client.mu.Lock()
	defer client.mu.Unlock()

	client.stopCalls = append(client.stopCalls, sessionID)
	if client.stopErr != nil {
		return nil, client.stopErr
	}
	return &audiopb.StopVoiceSessionResponse{SessionId: sessionID, Stopped: true}, nil
}

func (client *fakeVoiceRuntimeClient) Speak(
	_ context.Context,
	sessionID string,
	text string,
) (*audiopb.SpeakResponse, error) {
	client.mu.Lock()
	defer client.mu.Unlock()

	client.speakCalls = append(client.speakCalls, fakeSpeakInvocation{
		SessionID: sessionID,
		Text:      text,
	})
	if client.speakErr != nil {
		return nil, client.speakErr
	}
	return &audiopb.SpeakResponse{SessionId: sessionID, Accepted: true}, nil
}

func (client *fakeVoiceRuntimeClient) Close() error {
	return nil
}

func (client *fakeVoiceRuntimeClient) startInvocations() []fakeVoiceStartInvocation {
	client.mu.Lock()
	defer client.mu.Unlock()
	return append([]fakeVoiceStartInvocation(nil), client.startCalls...)
}

func (client *fakeVoiceRuntimeClient) stopInvocations() []string {
	client.mu.Lock()
	defer client.mu.Unlock()
	return append([]string(nil), client.stopCalls...)
}

func (client *fakeVoiceRuntimeClient) speakInvocations() []fakeSpeakInvocation {
	client.mu.Lock()
	defer client.mu.Unlock()
	return append([]fakeSpeakInvocation(nil), client.speakCalls...)
}

type fakeVoiceStream struct {
	ctx      context.Context
	events   []*audiopb.VoiceEvent
	index    int
	holdOpen bool
}

func (stream *fakeVoiceStream) Header() (metadata.MD, error) {
	return metadata.MD{}, nil
}

func (stream *fakeVoiceStream) Trailer() metadata.MD {
	return metadata.MD{}
}

func (stream *fakeVoiceStream) CloseSend() error {
	return nil
}

func (stream *fakeVoiceStream) Context() context.Context {
	return stream.ctx
}

func (stream *fakeVoiceStream) SendMsg(any) error {
	return nil
}

func (stream *fakeVoiceStream) RecvMsg(message any) error {
	event, err := stream.Recv()
	if err != nil {
		return err
	}
	target, ok := message.(*audiopb.VoiceEvent)
	if !ok {
		return fmt.Errorf("unexpected message type %T", message)
	}
	*target = *event
	return nil
}

func (stream *fakeVoiceStream) Recv() (*audiopb.VoiceEvent, error) {
	if stream.index < len(stream.events) {
		event := stream.events[stream.index]
		stream.index++
		return event, nil
	}

	select {
	case <-stream.ctx.Done():
		return nil, stream.ctx.Err()
	default:
		if stream.holdOpen {
			<-stream.ctx.Done()
			return nil, stream.ctx.Err()
		}
		return nil, io.EOF
	}
}
