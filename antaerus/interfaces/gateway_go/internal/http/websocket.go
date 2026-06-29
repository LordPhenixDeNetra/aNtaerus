package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/system"
	"github.com/gorilla/websocket"
)

type Hub struct {
	config        config.Config
	authenticator Authenticator
	rateLimiter   *RateLimiter
	brainChat     clients.BrainChatClient
	healthService system.HealthService
	upgrader      websocket.Upgrader
	register      chan *Client
	unregister    chan *Client
	clients       map[*Client]struct{}
	startOnce     sync.Once
	clientSeq     uint64
}

type Client struct {
	id        string
	conn      *websocket.Conn
	claims    Claims
	hub       *Hub
	send      chan contracts.ServerMessage
	done      chan struct{}
	closeOnce sync.Once
}

func NewHub(
	cfg config.Config,
	authenticator Authenticator,
	rateLimiter *RateLimiter,
	brainChat clients.BrainChatClient,
	healthService system.HealthService,
) *Hub {
	return &Hub{
		config:        cfg,
		authenticator: authenticator,
		rateLimiter:   rateLimiter,
		brainChat:     brainChat,
		healthService: healthService,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(*http.Request) bool { return true },
		},
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    map[*Client]struct{}{},
	}
}

func (hub *Hub) EnsureRunning() {
	hub.startOnce.Do(func() {
		go hub.run()
	})
}

func (hub *Hub) ServeWS(writer http.ResponseWriter, request *http.Request) {
	hub.EnsureRunning()

	claims, err := hub.authenticator.AuthenticateWebSocket(request)
	if err != nil {
		http.Error(writer, http.StatusText(http.StatusUnauthorized), http.StatusUnauthorized)
		return
	}

	if !hub.rateLimiter.AllowWSConnect(claims, requestIP(request)) {
		http.Error(writer, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
		return
	}

	connection, err := hub.upgrader.Upgrade(writer, request, nil)
	if err != nil {
		return
	}

	client := &Client{
		id:     hub.nextClientID(claims),
		conn:   connection,
		claims: claims,
		hub:    hub,
		send:   make(chan contracts.ServerMessage, 8),
		done:   make(chan struct{}),
	}

	hub.register <- client

	go client.writePump()
	go client.readPump()
	go client.heartbeatPump()
}

func (hub *Hub) run() {
	for {
		select {
		case client := <-hub.register:
			hub.clients[client] = struct{}{}
		case client := <-hub.unregister:
			if _, ok := hub.clients[client]; ok {
				delete(hub.clients, client)
				close(client.send)
			}
		}
	}
}

func (hub *Hub) nextClientID(claims Claims) string {
	sequence := atomic.AddUint64(&hub.clientSeq, 1)
	if claims.Subject == "" {
		return fmt.Sprintf("ws-client-%d", sequence)
	}

	return fmt.Sprintf("%s-%d", claims.Subject, sequence)
}

func (client *Client) readPump() {
	defer client.close()

	for {
		var message contracts.ClientMessage
		if err := client.conn.ReadJSON(&message); err != nil {
			return
		}

		if !client.hub.rateLimiter.AllowWSMessage(client.id, client.claims) {
			client.enqueue(alertMessage("warn", "WebSocket message rate limit exceeded"))
			continue
		}

		client.handleMessage(message)
	}
}

func (client *Client) writePump() {
	defer client.close()

	for {
		select {
		case <-client.done:
			return
		case message, ok := <-client.send:
			if !ok {
				return
			}

			if err := client.conn.WriteJSON(message); err != nil {
				return
			}
		}
	}
}

func (client *Client) heartbeatPump() {
	ticker := time.NewTicker(client.hub.config.WSHeartbeat)
	defer ticker.Stop()

	for {
		select {
		case <-client.done:
			return
		case <-ticker.C:
			services := client.hub.healthService.Services(context.Background())
			client.enqueue(serverMessage(contracts.ServerMessageHealthHeartbeat, contracts.HealthHeartbeatPayload{
				Services: convertServiceHealth(services),
			}))
		}
	}
}

func (client *Client) close() {
	client.closeOnce.Do(func() {
		close(client.done)
		client.hub.unregister <- client
		_ = client.conn.Close()
	})
}

func (client *Client) handleMessage(message contracts.ClientMessage) {
	switch contracts.ClientMessageType(message.Type) {
	case contracts.ClientMessageChat:
		var payload contracts.ChatMessagePayload
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			client.enqueue(alertMessage("error", "Invalid chat payload"))
			return
		}

		client.handleChatMessage(payload)
	case contracts.ClientMessageVoiceStart, contracts.ClientMessageVoiceStop, contracts.ClientMessageBargeIn:
		client.enqueue(alertMessage("info", "Voice transport placeholder active. Le pipeline voix n'est pas encore branche."))
	case contracts.ClientMessageCancel:
		var payload contracts.MissionCancelPayload
		if err := json.Unmarshal(message.Payload, &payload); err != nil {
			client.enqueue(alertMessage("error", "Invalid mission payload"))
			return
		}

		client.enqueue(serverMessage(contracts.ServerMessageMissionUpdate, contracts.MissionUpdatePayload{
			MissionID: payload.MissionID,
			Status:    "cancelled",
		}))
	default:
		client.enqueue(alertMessage("error", "Unsupported WebSocket message type"))
	}
}

func (client *Client) handleChatMessage(payload contracts.ChatMessagePayload) {
	err := client.hub.brainChat.StreamSession(
		context.Background(),
		clients.BrainSessionStreamRequest{
			SessionID: payload.SessionID,
			Message:   payload.Message,
		},
		func(event clients.BrainStreamEvent) error {
			switch event.Event {
			case "token":
				client.enqueue(serverMessage(contracts.ServerMessageChatToken, contracts.ChatTokenPayload{
					SessionID: payload.SessionID,
					Token:     stringValue(event.Data["text"]),
				}))
			case "complete":
				client.enqueue(serverMessage(contracts.ServerMessageChatComplete, contracts.ChatCompletePayload{
					SessionID: payload.SessionID,
					Message:   stringValue(event.Data["text"]),
				}))
			case "error":
				client.enqueue(alertMessage("error", stringValue(event.Data["message"])))
			}

			return nil
		},
	)
	if err != nil {
		client.enqueue(alertMessage("error", fmt.Sprintf("Brain chat stream failed: %v", err)))
	}
}

func (client *Client) enqueue(message contracts.ServerMessage) {
	select {
	case <-client.done:
		return
	case client.send <- message:
	default:
		client.close()
	}
}

func serverMessage(messageType contracts.ServerMessageType, payload any) contracts.ServerMessage {
	payloadBytes, _ := json.Marshal(payload)
	return contracts.ServerMessage{
		Envelope: contracts.Envelope{
			Type:      string(messageType),
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		},
		Payload: payloadBytes,
	}
}

func alertMessage(level string, message string) contracts.ServerMessage {
	return serverMessage(contracts.ServerMessageSystemAlert, contracts.SystemAlertPayload{
		Level:   level,
		Message: message,
	})
}

func convertServiceHealth(services []clients.ServiceHealth) []contracts.ServiceHealth {
	converted := make([]contracts.ServiceHealth, 0, len(services))
	for _, service := range services {
		converted = append(converted, contracts.ServiceHealth{
			Name:      service.Name,
			Status:    service.Status,
			Version:   service.Version,
			Port:      service.Port,
			URL:       service.URL,
			CheckedAt: service.CheckedAt,
			Details:   service.Details,
		})
	}

	return converted
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}
