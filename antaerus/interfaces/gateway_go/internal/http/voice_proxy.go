package httpapi

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/gen/audiopb"
)

func (hub *Hub) proxyVoiceSession(session *voiceSession) {
	defer func() {
		if err := hub.closeVoiceSession(session, false); err != nil {
			session.client.enqueue(alertMessage("warn", fmt.Sprintf("Voice session cleanup failed: %v", err)))
		}
	}()

	for {
		event, err := session.stream.Recv()
		if err != nil {
			if errors.Is(err, io.EOF) || errors.Is(err, context.Canceled) || session.closed.Load() {
				return
			}

			session.client.enqueue(alertMessage("error", fmt.Sprintf("Voice runtime stream failed: %v", err)))
			return
		}

		hub.forwardVoiceEvent(session, event)
	}
}

func (hub *Hub) forwardVoiceEvent(session *voiceSession, voiceEvent *audiopb.VoiceEvent) {
	sessionID := voiceEvent.GetSessionId()
	if sessionID == "" {
		sessionID = session.sessionID
	}

	if vad := voiceEvent.GetVad(); vad != nil {
		state := "silence"
		if vad.GetSpeaking() {
			state = "speaking"
		}
		session.client.enqueue(serverMessage(contracts.ServerMessageVoiceVADState, contracts.VoiceVADStatePayload{
			SessionID: sessionID,
			State:     state,
		}))
		return
	}

	if transcript := voiceEvent.GetTranscript(); transcript != nil {
		text := transcript.GetText()
		session.client.enqueue(serverMessage(contracts.ServerMessageVoiceTranscript, contracts.VoiceTranscriptPayload{
			SessionID:  sessionID,
			Transcript: text,
		}))
		if transcript.GetIsFinal() && strings.TrimSpace(text) != "" {
			go hub.processFinalTranscript(session, text)
		}
		return
	}

	if systemEvent := voiceEvent.GetSystem(); systemEvent != nil {
		level := strings.TrimSpace(systemEvent.GetLevel())
		if level == "" {
			level = "info"
		}
		session.client.enqueue(alertMessage(level, systemEvent.GetMessage()))
	}
}

func (hub *Hub) processFinalTranscript(session *voiceSession, transcript string) {
	processCtx, cancel, generation := session.startProcessingContext()
	defer cancel()
	defer session.clearProcessing(generation)

	request := clients.BrainSessionStreamRequest{
		SessionID: session.sessionID,
		Message:   transcript,
	}

	var finalText string
	err := hub.brainChat.StreamSession(
		processCtx,
		request,
		func(event clients.BrainStreamEvent) error {
			if !session.isCurrent(generation) {
				return context.Canceled
			}

			switch event.Event {
			case "token":
				session.client.enqueue(serverMessage(contracts.ServerMessageChatToken, contracts.ChatTokenPayload{
					SessionID: session.sessionID,
					Token:     stringValue(event.Data["text"]),
				}))
			case "complete":
				finalText = stringValue(event.Data["text"])
				session.client.enqueue(serverMessage(contracts.ServerMessageChatComplete, contracts.ChatCompletePayload{
					SessionID: session.sessionID,
					Message:   finalText,
				}))
			case "error":
				session.client.enqueue(alertMessage("error", stringValue(event.Data["message"])))
			}

			return nil
		},
	)
	if err != nil {
		if errors.Is(err, context.Canceled) || processCtx.Err() != nil || !session.isCurrent(generation) {
			return
		}
		session.client.enqueue(alertMessage("error", fmt.Sprintf("Voice brain stream failed: %v", err)))
		return
	}

	if !session.isCurrent(generation) || strings.TrimSpace(finalText) == "" {
		return
	}

	response, err := session.runtime.Speak(processCtx, session.sessionID, finalText)
	if err != nil {
		if errors.Is(err, context.Canceled) || processCtx.Err() != nil || !session.isCurrent(generation) {
			return
		}
		session.client.enqueue(alertMessage("error", fmt.Sprintf("Voice synthesis failed: %v", err)))
		return
	}

	if response != nil && !response.GetAccepted() {
		session.client.enqueue(alertMessage("warn", "Voice synthesis request was rejected by engine_rust"))
	}
}
