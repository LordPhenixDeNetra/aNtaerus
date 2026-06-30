package httpapi

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/gen/audiopb"
	"google.golang.org/grpc"
)

const defaultVoiceLanguage = "fr"

type voiceRuntimeClient interface {
	StartVoiceSession(ctx context.Context, sessionID string, language string) (grpc.ServerStreamingClient[audiopb.VoiceEvent], error)
	StopVoiceSession(ctx context.Context, sessionID string) (*audiopb.StopVoiceSessionResponse, error)
	Speak(ctx context.Context, sessionID string, text string) (*audiopb.SpeakResponse, error)
	Close() error
}

type voiceRuntimeFactory func(ctx context.Context) (voiceRuntimeClient, error)

type voiceSession struct {
	key       string
	client    *Client
	sessionID string
	language  string
	runtime   voiceRuntimeClient
	stream    grpc.ServerStreamingClient[audiopb.VoiceEvent]
	ctx       context.Context
	cancel    context.CancelFunc

	generation atomic.Uint64
	closed     atomic.Bool

	processingMu         sync.Mutex
	processingGeneration uint64
	processingCancel     context.CancelFunc
}

func newDefaultVoiceRuntimeFactory(target string) voiceRuntimeFactory {
	return func(ctx context.Context) (voiceRuntimeClient, error) {
		return clients.NewEngineGRPCClient(ctx, target)
	}
}

func (hub *Hub) voiceSessionKey(client *Client, sessionID string) string {
	return client.id + ":" + sessionID
}

func (hub *Hub) getVoiceSession(client *Client, sessionID string) *voiceSession {
	key := hub.voiceSessionKey(client, sessionID)
	hub.voiceMu.Lock()
	defer hub.voiceMu.Unlock()
	return hub.voiceSessions[key]
}

func (hub *Hub) setVoiceSession(session *voiceSession) bool {
	hub.voiceMu.Lock()
	defer hub.voiceMu.Unlock()
	if _, exists := hub.voiceSessions[session.key]; exists {
		return false
	}
	hub.voiceSessions[session.key] = session
	return true
}

func (hub *Hub) removeVoiceSessionByKey(key string) *voiceSession {
	hub.voiceMu.Lock()
	defer hub.voiceMu.Unlock()
	session := hub.voiceSessions[key]
	delete(hub.voiceSessions, key)
	return session
}

func (hub *Hub) stopAllVoiceSessions(client *Client) {
	hub.voiceMu.Lock()
	sessions := make([]*voiceSession, 0, len(hub.voiceSessions))
	for _, session := range hub.voiceSessions {
		if session.client == client {
			sessions = append(sessions, session)
		}
	}
	hub.voiceMu.Unlock()

	for _, session := range sessions {
		if err := hub.closeVoiceSession(session, true); err != nil {
			client.enqueue(alertMessage("warn", fmt.Sprintf("Voice cleanup failed: %v", err)))
		}
	}
}

func (hub *Hub) startVoiceSession(client *Client, sessionID string, language string) error {
	if sessionID == "" {
		return fmt.Errorf("sessionId must not be empty")
	}
	if existing := hub.getVoiceSession(client, sessionID); existing != nil {
		client.enqueue(alertMessage("warn", "Voice session already active for this sessionId"))
		return nil
	}

	dialCtx, dialCancel := context.WithTimeout(context.Background(), hub.config.RequestTimeout)
	defer dialCancel()

	runtimeClient, err := hub.voiceRuntimeFactory(dialCtx)
	if err != nil {
		return fmt.Errorf("connect voice runtime: %w", err)
	}

	sessionCtx, sessionCancel := context.WithCancel(context.Background())
	stream, err := runtimeClient.StartVoiceSession(sessionCtx, sessionID, language)
	if err != nil {
		sessionCancel()
		_ = runtimeClient.Close()
		return fmt.Errorf("start voice session: %w", err)
	}

	session := &voiceSession{
		key:       hub.voiceSessionKey(client, sessionID),
		client:    client,
		sessionID: sessionID,
		language:  language,
		runtime:   runtimeClient,
		stream:    stream,
		ctx:       sessionCtx,
		cancel:    sessionCancel,
	}
	if !hub.setVoiceSession(session) {
		sessionCancel()
		_, _ = runtimeClient.StopVoiceSession(context.Background(), sessionID)
		_ = runtimeClient.Close()
		client.enqueue(alertMessage("warn", "Voice session already active for this sessionId"))
		return nil
	}

	go hub.proxyVoiceSession(session)
	return nil
}

func (hub *Hub) stopVoiceSession(client *Client, sessionID string) error {
	session := hub.getVoiceSession(client, sessionID)
	if session == nil {
		client.enqueue(alertMessage("info", "No active voice session for this sessionId"))
		return nil
	}
	return hub.closeVoiceSession(session, true)
}

func (hub *Hub) bargeInVoiceSession(client *Client, sessionID string) error {
	session := hub.getVoiceSession(client, sessionID)
	if session == nil {
		client.enqueue(alertMessage("info", "No active voice session to interrupt"))
		return nil
	}

	language := session.language
	if err := hub.closeVoiceSession(session, true); err != nil {
		return err
	}
	return hub.startVoiceSession(client, sessionID, language)
}

func (hub *Hub) closeVoiceSession(session *voiceSession, requestStop bool) error {
	if session == nil {
		return nil
	}
	if !session.closed.CompareAndSwap(false, true) {
		return nil
	}

	hub.removeVoiceSessionByKey(session.key)
	session.invalidate()
	session.cancel()

	var firstErr error
	if requestStop {
		stopCtx, cancel := context.WithTimeout(context.Background(), hub.config.RequestTimeout)
		if _, err := session.runtime.StopVoiceSession(stopCtx, session.sessionID); err != nil {
			firstErr = err
		}
		cancel()
	}

	if err := session.runtime.Close(); err != nil && firstErr == nil {
		firstErr = err
	}

	return firstErr
}

func (session *voiceSession) startProcessingContext() (context.Context, context.CancelFunc, uint64) {
	session.processingMu.Lock()
	defer session.processingMu.Unlock()

	if session.processingCancel != nil {
		session.processingCancel()
	}

	ctx, cancel := context.WithCancel(session.ctx)
	session.processingCancel = cancel
	generation := session.generation.Add(1)
	session.processingGeneration = generation
	return ctx, cancel, generation
}

func (session *voiceSession) clearProcessing(generation uint64) {
	session.processingMu.Lock()
	defer session.processingMu.Unlock()
	if session.processingGeneration == generation {
		session.processingCancel = nil
		session.processingGeneration = 0
	}
}

func (session *voiceSession) invalidate() {
	session.processingMu.Lock()
	if session.processingCancel != nil {
		session.processingCancel()
		session.processingCancel = nil
	}
	session.processingGeneration = 0
	session.processingMu.Unlock()
	session.generation.Add(1)
}

func (session *voiceSession) isCurrent(generation uint64) bool {
	return !session.closed.Load() && session.generation.Load() == generation
}

func (client *Client) handleVoiceControl(action contracts.ClientMessageType, payload contracts.SessionControlPayload) {
	if payload.SessionID == "" {
		client.enqueue(alertMessage("error", "Invalid voice payload: missing sessionId"))
		return
	}

	var err error
	switch action {
	case contracts.ClientMessageVoiceStart:
		err = client.hub.startVoiceSession(client, payload.SessionID, defaultVoiceLanguage)
	case contracts.ClientMessageVoiceStop:
		err = client.hub.stopVoiceSession(client, payload.SessionID)
	case contracts.ClientMessageBargeIn:
		err = client.hub.bargeInVoiceSession(client, payload.SessionID)
	}

	if err != nil {
		client.enqueue(alertMessage("error", fmt.Sprintf("Voice control failed: %v", err)))
	}
}
