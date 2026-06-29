package httpapi

import (
	"encoding/json"
	"net/http"

	"antaerus/interfaces/gateway_go/internal/config"
)

type devTokenRequest struct {
	Subject string `json:"subject"`
	Role    string `json:"role"`
}

type devTokenResponse struct {
	Token string `json:"token"`
}

func NewDevTokenHandler(cfg config.Config, authenticator Authenticator) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
			return
		}

		if cfg.Environment == "production" {
			http.Error(writer, http.StatusText(http.StatusForbidden), http.StatusForbidden)
			return
		}

		var payload devTokenRequest
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			http.Error(writer, "invalid JSON payload", http.StatusBadRequest)
			return
		}

		if payload.Subject == "" {
			payload.Subject = "web-dev-user"
		}
		if payload.Role == "" {
			payload.Role = "user"
		}

		token, err := authenticator.IssueToken(payload.Subject, payload.Role)
		if err != nil {
			http.Error(writer, err.Error(), http.StatusBadRequest)
			return
		}

		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(devTokenResponse{Token: token})
	}
}
