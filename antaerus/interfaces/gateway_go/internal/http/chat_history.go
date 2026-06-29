package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"antaerus/interfaces/gateway_go/internal/clients"
)

func NewChatHistoryHandler(brainChat clients.BrainChatClient) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		sessionID := strings.TrimPrefix(request.URL.Path, "/api/v1/chat/sessions/")
		sessionID = strings.TrimSpace(sessionID)
		if sessionID == "" || strings.Contains(sessionID, "/") {
			http.Error(writer, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		history, err := brainChat.GetSessionHistory(context.Background(), sessionID)
		if err != nil {
			http.Error(writer, err.Error(), http.StatusBadGateway)
			return
		}

		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(history)
	}
}
