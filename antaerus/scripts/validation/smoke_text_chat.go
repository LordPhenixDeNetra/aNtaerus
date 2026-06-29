package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type tokenResponse struct {
	Token string `json:"token"`
}

type historyResponse struct {
	SessionID string `json:"sessionId"`
	Messages  []struct {
		Content string `json:"content"`
	} `json:"messages"`
}

type chatMessagePayload struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}

type websocketClientMessage struct {
	Type      string          `json:"type"`
	Timestamp string          `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

type websocketServerMessage struct {
	Type      string          `json:"type"`
	Timestamp string          `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

func main() {
	baseURL := getenv("ANTAERUS_GATEWAY_URL", "http://127.0.0.1:8080")
	httpClient := &http.Client{Timeout: 5 * time.Second}

	token, err := requestDevToken(httpClient, baseURL)
	if err != nil {
		fatal("request dev token: %v", err)
	}

	firstStarted := time.Now()
	if err := runSession(httpClient, baseURL, token, "smoke-session-a", "Bonjour depuis la session A"); err != nil {
		fatal("run session A: %v", err)
	}
	firstDuration := time.Since(firstStarted)
	if firstDuration > 2*time.Second {
		fatal("session A exceeded 2s objective: %s", firstDuration)
	}

	if err := runSession(httpClient, baseURL, token, "smoke-session-b", "Bonjour depuis la session B"); err != nil {
		fatal("run session B: %v", err)
	}

	firstHistory, err := fetchHistory(httpClient, baseURL, "smoke-session-a")
	if err != nil {
		fatal("fetch history A: %v", err)
	}
	secondHistory, err := fetchHistory(httpClient, baseURL, "smoke-session-b")
	if err != nil {
		fatal("fetch history B: %v", err)
	}

	if strings.Contains(historyContents(firstHistory), "session B") {
		fatal("session A leaked session B content")
	}
	if strings.Contains(historyContents(secondHistory), "session A") {
		fatal("session B leaked session A content")
	}

	fmt.Printf("M1.4 smoke passed in %s\n", firstDuration)
}

func requestDevToken(httpClient *http.Client, baseURL string) (string, error) {
	payload, err := json.Marshal(map[string]string{
		"subject": "smoke-user",
		"role":    "user",
	})
	if err != nil {
		return "", err
	}

	response, err := httpClient.Post(baseURL+"/api/v1/auth/dev-token", "application/json", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %d", response.StatusCode)
	}

	var decoded tokenResponse
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return "", err
	}

	return decoded.Token, nil
}

func runSession(httpClient *http.Client, baseURL string, token string, sessionID string, message string) error {
	websocketURL, err := buildWebSocketURL(baseURL, token)
	if err != nil {
		return err
	}

	connection, _, err := websocket.DefaultDialer.Dial(websocketURL, nil)
	if err != nil {
		return err
	}
	defer connection.Close()

	if err := connection.SetReadDeadline(time.Now().Add(35 * time.Second)); err != nil {
		return err
	}

	payload, err := json.Marshal(chatMessagePayload{
		SessionID: sessionID,
		Message:   message,
	})
	if err != nil {
		return err
	}

	if err := connection.WriteJSON(websocketClientMessage{
		Type:      "chat.message",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Payload:   payload,
	}); err != nil {
		return err
	}

	sawToken := false
	sawComplete := false
	for !(sawToken && sawComplete) {
		var response websocketServerMessage
		if err := connection.ReadJSON(&response); err != nil {
			return err
		}

		switch response.Type {
		case "chat.token":
			sawToken = true
		case "chat.complete":
			sawComplete = true
		case "system.alert":
			return fmt.Errorf("received system alert: %s", string(response.Payload))
		}
	}

	history, err := fetchHistory(httpClient, baseURL, sessionID)
	if err != nil {
		return err
	}
	if len(history.Messages) < 2 {
		return fmt.Errorf("expected at least 2 messages in history for %s", sessionID)
	}

	return nil
}

func fetchHistory(httpClient *http.Client, baseURL string, sessionID string) (historyResponse, error) {
	response, err := httpClient.Get(baseURL + "/api/v1/chat/sessions/" + sessionID)
	if err != nil {
		return historyResponse{}, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return historyResponse{}, fmt.Errorf("unexpected status %d", response.StatusCode)
	}

	var history historyResponse
	if err := json.NewDecoder(response.Body).Decode(&history); err != nil {
		return historyResponse{}, err
	}
	return history, nil
}

func buildWebSocketURL(baseURL string, token string) (string, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return "", err
	}

	if parsed.Scheme == "https" {
		parsed.Scheme = "wss"
	} else {
		parsed.Scheme = "ws"
	}

	parsed.Path = "/api/v1/ws"
	query := parsed.Query()
	query.Set("token", token)
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func historyContents(history historyResponse) string {
	parts := make([]string, 0, len(history.Messages))
	for _, message := range history.Messages {
		parts = append(parts, message.Content)
	}
	return strings.Join(parts, " ")
}

func getenv(name string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	return value
}

func fatal(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
