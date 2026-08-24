package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"

	"antaerus/interfaces/gateway_go/internal/clients"
)

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	if payload == nil {
		return
	}
	_ = json.NewEncoder(writer).Encode(payload)
}

func writeMissionError(writer http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	var missionErr clients.BrainMissionError
	if errors.As(err, &missionErr) {
		status := missionErr.StatusCode
		if status < 400 || status >= 600 {
			status = http.StatusBadGateway
		}
		http.Error(writer, missionErr.Body, status)
		return
	}
	http.Error(writer, err.Error(), http.StatusBadGateway)
}

func missionHTTPStatus(status string) int {
	switch status {
	case "planned", "pending_approval", "paused":
		return http.StatusAccepted
	case "running":
		return http.StatusAccepted
	case "completed":
		return http.StatusOK
	case "failed", "cancelled":
		return http.StatusOK
	case "draft":
		return http.StatusCreated
	}
	return http.StatusOK
}
