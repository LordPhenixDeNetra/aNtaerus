export type WebSocketClientMessageType =
  | "chat.message"
  | "voice.start"
  | "voice.stop"
  | "voice.barge_in"
  | "mission.cancel";

export type WebSocketServerMessageType =
  | "chat.token"
  | "chat.complete"
  | "voice.transcript"
  | "voice.audio"
  | "voice.vad_state"
  | "mission.update"
  | "system.alert"
  | "proactive.notification"
  | "health.heartbeat";

type Envelope<TType extends string, TPayload> = {
  type: TType;
  timestamp: string;
  payload: TPayload;
};

export type ChatMessagePayload = {
  sessionId: string;
  message: string;
};

export type SessionControlPayload = {
  sessionId: string;
};

export type MissionCancelPayload = {
  missionId: string;
};

export type WebSocketClientMessage =
  | Envelope<"chat.message", ChatMessagePayload>
  | Envelope<"voice.start", SessionControlPayload>
  | Envelope<"voice.stop", SessionControlPayload>
  | Envelope<"voice.barge_in", SessionControlPayload>
  | Envelope<"mission.cancel", MissionCancelPayload>;

export type ChatTokenPayload = {
  sessionId: string;
  token: string;
};

export type ChatCompletePayload = {
  sessionId: string;
  message: string;
};

export type VoiceTranscriptPayload = {
  sessionId: string;
  transcript: string;
};

export type VoiceAudioPayload = {
  sessionId: string;
  audioBase64: string;
};

export type VoiceVADStatePayload = {
  sessionId: string;
  state: "speaking" | "silence";
};

export type MissionUpdatePayload = {
  missionId: string;
  status: string;
};

export type SystemAlertPayload = {
  level: string;
  message: string;
};

export type ProactiveNotificationPayload = {
  notificationId: string;
  message: string;
};

export type HealthHeartbeatPayload = {
  services: Array<{
    name: string;
    status: "healthy" | "degraded" | "offline";
    version: string;
    port: number;
    url: string;
    checkedAt: string;
    details?: string;
  }>;
};

export type WebSocketServerMessage =
  | Envelope<"chat.token", ChatTokenPayload>
  | Envelope<"chat.complete", ChatCompletePayload>
  | Envelope<"voice.transcript", VoiceTranscriptPayload>
  | Envelope<"voice.audio", VoiceAudioPayload>
  | Envelope<"voice.vad_state", VoiceVADStatePayload>
  | Envelope<"mission.update", MissionUpdatePayload>
  | Envelope<"system.alert", SystemAlertPayload>
  | Envelope<"proactive.notification", ProactiveNotificationPayload>
  | Envelope<"health.heartbeat", HealthHeartbeatPayload>;
