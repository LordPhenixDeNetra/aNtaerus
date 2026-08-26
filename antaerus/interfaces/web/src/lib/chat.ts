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

const DSML_PREFIX = /<\s*(?:\|\s*)+DSML\s*(?:\|\s*)+/i.source;
const DSML_PREFIX_CLOSE = /<\s*\/\s*(?:\|\s*)+DSML\s*(?:\|\s*)+/i.source;
const DSML_SUFFIX_OPEN_TAG = /(?:\|\s*)*>/i.source;
const DSML_TOOL_CALLS_RE = new RegExp(
  `${DSML_PREFIX}tool_calls\\s*${DSML_SUFFIX_OPEN_TAG}.*?${DSML_PREFIX_CLOSE}\\/?tool_calls\\s*${DSML_SUFFIX_OPEN_TAG}`,
  "gis",
);
const DSML_INVOKE_RE = new RegExp(
  `${DSML_PREFIX}invoke\\s+name\\s*=\\s*"[^"]*"\\s*${DSML_SUFFIX_OPEN_TAG}.*?${DSML_PREFIX_CLOSE}\\/?invoke\\s*${DSML_SUFFIX_OPEN_TAG}`,
  "gis",
);
const DSML_PARAM_RE = new RegExp(
  `${DSML_PREFIX}parameter\\s+name\\s*=\\s*"[^"]*"\\s*(?:string\\s*=\\s*"true")?\\s*${DSML_SUFFIX_OPEN_TAG}.*?${DSML_PREFIX_CLOSE}\\/?parameter\\s*${DSML_SUFFIX_OPEN_TAG}`,
  "gis",
);
const DSML_ANY_BLOCK_RE = new RegExp(
  `${DSML_PREFIX}.*?(?:\\|\\s*\\|>)?|${DSML_PREFIX_CLOSE}.*?(?:\\|\\s*\\|>)?`,
  "gis",
);

export function sanitizeAssistantText(raw: string): string {
  if (!raw) return raw;
  let cleaned = raw.replace(DSML_TOOL_CALLS_RE, "");
  cleaned = cleaned.replace(DSML_INVOKE_RE, "");
  cleaned = cleaned.replace(DSML_PARAM_RE, "");
  cleaned = cleaned.replace(DSML_ANY_BLOCK_RE, "");
  return cleaned.trim();
}

export function createChatMessage(
  role: ChatRole,
  content: string,
  transport: ChatTransportMode,
  status: ChatMessageStatus = "complete",
) {
  const safeContent = role === "assistant" ? sanitizeAssistantText(content) : content;
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${role}-${Date.now()}`,
    role,
    content: safeContent,
    status,
    createdAt: new Date().toISOString(),
    transport,
  } satisfies ChatMessage;
}

export function fromHistoryMessage(
  message: ChatHistoryMessage,
  transport: ChatTransportMode = "ws",
): ChatMessage {
  const safeContent = message.role === "assistant"
    ? sanitizeAssistantText(message.content ?? "")
    : (message.content ?? "");
  return {
    id: message.id,
    role: message.role,
    content: safeContent,
    status: "complete",
    createdAt: message.createdAt,
    transport,
  };
}

