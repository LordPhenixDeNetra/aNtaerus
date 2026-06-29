package clients

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type BrainChatClient struct {
	httpClient     httpClient
	baseURL        string
	requestTimeout time.Duration
}

type BrainSessionStreamRequest struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
	Provider  string `json:"provider,omitempty"`
}

type BrainSessionHistory struct {
	SessionID string                `json:"sessionId"`
	Messages  []BrainHistoryMessage `json:"messages"`
}

type BrainHistoryMessage struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	Provider  string `json:"provider,omitempty"`
	CreatedAt string `json:"createdAt"`
}

type BrainStreamEvent struct {
	Event string
	Data  map[string]any
}

func NewBrainChatClient(
	httpClient *http.Client,
	baseURL string,
	requestTimeout time.Duration,
) BrainChatClient {
	client := httpClient
	if client == nil {
		client = &http.Client{Timeout: requestTimeout}
	}

	return BrainChatClient{
		httpClient:     client,
		baseURL:        strings.TrimRight(baseURL, "/"),
		requestTimeout: requestTimeout,
	}
}

func (client BrainChatClient) StreamSession(
	ctx context.Context,
	request BrainSessionStreamRequest,
	onEvent func(BrainStreamEvent) error,
) error {
	payload, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("marshal brain stream request: %w", err)
	}

	requestCtx, cancel := context.WithTimeout(ctx, client.requestTimeout)
	defer cancel()

	httpRequest, err := http.NewRequestWithContext(
		requestCtx,
		http.MethodPost,
		client.baseURL+"/llm/session-stream",
		bytes.NewReader(payload),
	)
	if err != nil {
		return fmt.Errorf("create brain stream request: %w", err)
	}

	httpRequest.Header.Set("Content-Type", "application/json")
	response, err := client.httpClient.Do(httpRequest)
	if err != nil {
		return fmt.Errorf("call brain stream endpoint: %w", err)
	}
	defer closeBody(response)

	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("brain stream returned status %d", response.StatusCode)
	}

	scanner := bufio.NewScanner(response.Body)
	currentEvent := ""
	currentData := ""

	flush := func() error {
		if currentEvent == "" || currentData == "" {
			return nil
		}

		var payload map[string]any
		if err := json.Unmarshal([]byte(currentData), &payload); err != nil {
			return fmt.Errorf("decode brain SSE payload: %w", err)
		}

		if err := onEvent(BrainStreamEvent{Event: currentEvent, Data: payload}); err != nil {
			return err
		}

		currentEvent = ""
		currentData = ""
		return nil
	}

	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			if err := flush(); err != nil {
				return err
			}
			continue
		}

		if strings.HasPrefix(line, "event:") {
			currentEvent = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}
		if strings.HasPrefix(line, "data:") {
			currentData = strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan brain SSE stream: %w", err)
	}

	return flush()
}

func (client BrainChatClient) GetSessionHistory(
	ctx context.Context,
	sessionID string,
) (BrainSessionHistory, error) {
	requestCtx, cancel := context.WithTimeout(ctx, client.requestTimeout)
	defer cancel()

	httpRequest, err := http.NewRequestWithContext(
		requestCtx,
		http.MethodGet,
		client.baseURL+"/memory/chat/sessions/"+sessionID,
		nil,
	)
	if err != nil {
		return BrainSessionHistory{}, fmt.Errorf("create brain history request: %w", err)
	}

	response, err := client.httpClient.Do(httpRequest)
	if err != nil {
		return BrainSessionHistory{}, fmt.Errorf("call brain history endpoint: %w", err)
	}
	defer closeBody(response)

	if response.StatusCode != http.StatusOK {
		return BrainSessionHistory{}, fmt.Errorf("brain history returned status %d", response.StatusCode)
	}

	var history BrainSessionHistory
	if err := json.NewDecoder(response.Body).Decode(&history); err != nil {
		return BrainSessionHistory{}, fmt.Errorf("decode brain history response: %w", err)
	}

	return history, nil
}
