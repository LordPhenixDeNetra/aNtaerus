import type { ChatTransportMode } from "@/lib/setup";

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
