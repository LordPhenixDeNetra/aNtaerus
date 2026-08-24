package httpapi

import (
	"encoding/json"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/contracts"
)

func (hub *Hub) BroadcastMissionUpdate(
	mission clients.Mission,
	stepResult *clients.StepResult,
) {
	payload := contracts.MissionUpdatePayload{
		MissionID: mission.ID,
		Status:    mission.Status,
		Error:     mission.Error,
	}
	for i := range mission.Steps {
		step := mission.Steps[i]
		stepStatus := step.Status
		if stepStatus == "running" || stepStatus == "failed" || stepStatus == "completed" {
			idx := step.Index
			stepID := step.ID
			payload.StepIndex = &idx
			payload.StepID = &stepID
			payload.StepStatus = &stepStatus
			break
		}
	}
	if stepResult != nil {
		raw, err := json.Marshal(stepResult)
		if err == nil {
			asString := string(raw)
			payload.StepResultJSON = &asString
		}
	}
	msg := serverMessage(contracts.ServerMessageMissionUpdate, payload)
	select {
	case hub.broadcast <- msg:
	default:
		// drop if broadcast buffer full
	}
}
