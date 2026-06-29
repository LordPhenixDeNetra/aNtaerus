package clients

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestBrainChatClientStreamsEvents(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/llm/session-stream" {
			t.Fatalf("unexpected path %s", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "text/event-stream")
		_, _ = writer.Write([]byte("event: token\ndata: {\"text\":\"Bon\",\"sessionId\":\"session-1\"}\n\n"))
		_, _ = writer.Write([]byte("event: complete\ndata: {\"text\":\"Bonjour\",\"sessionId\":\"session-1\"}\n\n"))
	}))
	defer server.Close()

	client := NewBrainChatClient(server.Client(), server.URL, time.Second)
	events := make([]BrainStreamEvent, 0, 2)

	err := client.StreamSession(context.Background(), BrainSessionStreamRequest{
		SessionID: "session-1",
		Message:   "Bonjour",
	}, func(event BrainStreamEvent) error {
		events = append(events, event)
		return nil
	})
	if err != nil {
		t.Fatalf("expected stream session to succeed, got %v", err)
	}

	if len(events) != 2 {
		t.Fatalf("expected 2 events, got %d", len(events))
	}
	if events[0].Event != "token" {
		t.Fatalf("expected first event token, got %q", events[0].Event)
	}
}

func TestBrainChatClientFetchesSessionHistory(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/memory/chat/sessions/session-1" {
			t.Fatalf("unexpected path %s", request.URL.Path)
		}

		writer.Header().Set("Content-Type", "application/json")
		_, _ = writer.Write([]byte(`{"sessionId":"session-1","messages":[{"id":"msg-1","sessionId":"session-1","role":"user","content":"Bonjour","createdAt":"2026-01-01T00:00:00Z"}]}`))
	}))
	defer server.Close()

	client := NewBrainChatClient(server.Client(), server.URL, time.Second)
	history, err := client.GetSessionHistory(context.Background(), "session-1")
	if err != nil {
		t.Fatalf("expected history fetch to succeed, got %v", err)
	}

	if history.SessionID != "session-1" {
		t.Fatalf("expected session-1, got %q", history.SessionID)
	}
	if len(history.Messages) != 1 {
		t.Fatalf("expected one message, got %d", len(history.Messages))
	}
}
