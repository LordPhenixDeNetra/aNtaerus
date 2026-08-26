package contracts

import "encoding/json"

type ClientMessageType string

const (
	ClientMessageChat       ClientMessageType = "chat.message"
	ClientMessageVoiceStart ClientMessageType = "voice.start"
	ClientMessageVoiceStop  ClientMessageType = "voice.stop"
	ClientMessageBargeIn    ClientMessageType = "voice.barge_in"
	ClientMessageCancel     ClientMessageType = "mission.cancel"
	ClientMessageScheduler  ClientMessageType = "scheduler.command"
)

type ServerMessageType string

const (
	ServerMessageChatToken             ServerMessageType = "chat.token"
	ServerMessageChatComplete          ServerMessageType = "chat.complete"
	ServerMessageChatError             ServerMessageType = "chat.error"
	ServerMessageVoiceTranscript       ServerMessageType = "voice.transcript"
	ServerMessageVoiceAudio            ServerMessageType = "voice.audio"
	ServerMessageVoiceVADState         ServerMessageType = "voice.vad_state"
	ServerMessageVoiceWakeState        ServerMessageType = "voice.wake_state"
	ServerMessageMissionUpdate         ServerMessageType = "mission.update"
	ServerMessageInitiativeUpdate      ServerMessageType = "initiative.update"
	ServerMessageSystemAlert           ServerMessageType = "system.alert"
	ServerMessageProactiveNotification ServerMessageType = "proactive.notification"
	ServerMessageHealthHeartbeat       ServerMessageType = "health.heartbeat"
)

type Envelope struct {
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
}

type ClientMessage struct {
	Envelope
	Payload json.RawMessage `json:"payload"`
}

type ServerMessage struct {
	Envelope
	Payload json.RawMessage `json:"payload"`
}

type ChatMessagePayload struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}

type SessionControlPayload struct {
	SessionID string `json:"sessionId"`
}

type MissionCancelPayload struct {
	MissionID string `json:"missionId"`
}

type ChatTokenPayload struct {
	SessionID string `json:"sessionId"`
	Token     string `json:"token"`
}

type ChatCompletePayload struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
}

type ChatErrorPayload struct {
	SessionID string `json:"sessionId"`
	Message   string `json:"message"`
	Code      string `json:"code,omitempty"`
}

type VoiceTranscriptPayload struct {
	SessionID  string `json:"sessionId"`
	Transcript string `json:"transcript"`
}

type VoiceAudioPayload struct {
	SessionID   string `json:"sessionId"`
	AudioBase64 string `json:"audioBase64"`
}

type VoiceVADStatePayload struct {
	SessionID string `json:"sessionId"`
	State     string `json:"state"`
}

type VoiceWakeStatePayload struct {
	SessionID string `json:"sessionId"`
	State     string `json:"state"`
}

type MissionUpdatePayload struct {
	MissionID      string  `json:"missionId"`
	Status         string  `json:"status"`
	StepIndex      *int    `json:"stepIndex,omitempty"`
	StepID         *string `json:"stepId,omitempty"`
	StepStatus     *string `json:"stepStatus,omitempty"`
	StepResultJSON *string `json:"stepResultJson,omitempty"`
	Error          *string `json:"error,omitempty"`
}

type InitiativeUpdatePayload struct {
	InitiativeID     string  `json:"initiativeId"`
	Status           string  `json:"status"`
	AutonomyLevel    *int    `json:"autonomyLevel,omitempty"`
	BudgetTokens     int     `json:"budgetTokens,omitempty"`
	BudgetTokensUsed int     `json:"budgetTokensUsed,omitempty"`
	RanAt            *string `json:"ranAt,omitempty"`
	CompletedAt      *string `json:"completedAt,omitempty"`
	Error            *string `json:"error,omitempty"`
	UpdatedAt        string  `json:"updatedAt"`
}

type SchedulerCommandPayload struct {
	Action   string `json:"action"`
	CronHour *int   `json:"cronHour,omitempty"`
}

type SystemAlertPayload struct {
	Level   string `json:"level"`
	Message string `json:"message"`
}

type ProactiveNotificationPayload struct {
	NotificationID string `json:"notificationId"`
	Message        string `json:"message"`
}

type HealthHeartbeatPayload struct {
	Services []ServiceHealth `json:"services"`
}

type ServiceHealth struct {
	Name      string `json:"name"`
	Status    string `json:"status"`
	Version   string `json:"version"`
	Port      int    `json:"port"`
	URL       string `json:"url"`
	CheckedAt string `json:"checkedAt"`
	Details   string `json:"details,omitempty"`
}
