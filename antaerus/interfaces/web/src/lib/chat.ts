import type { ChatTransportMode } from "@/lib/setup";
import type { ChatHistoryMessage } from "@/lib/api";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessageStatus = "complete" | "streaming" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status: ChatMessageStatus;
  createdAt: string;
  transport: ChatTransportMode;
};

export function createChatMessage(
  role: ChatRole,
  content: string,
  transport: ChatTransportMode,
  status: ChatMessageStatus = "complete",
) {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${role}-${Date.now()}`,
    role,
    content,
    status,
    createdAt: new Date().toISOString(),
    transport,
  } satisfies ChatMessage;
}

export function fromHistoryMessage(
  message: ChatHistoryMessage,
  transport: ChatTransportMode = "ws",
): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: "complete",
    createdAt: message.createdAt,
    transport,
  };
}
