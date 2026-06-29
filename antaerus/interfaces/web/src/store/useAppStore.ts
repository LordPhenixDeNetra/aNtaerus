import { create } from "zustand";

import {
  createChatMessage,
  type ChatMessage,
  type ChatMessageStatus,
} from "@/lib/chat";
import { loadSetupConfig, saveSetupConfig } from "@/lib/storage";
import {
  type ChatTransportMode,
  type LocalSetupConfig,
} from "@/lib/setup";
import type { HealthHeartbeatPayload } from "@/lib/ws";

export type ConnectionState = "idle" | "connecting" | "connected" | "error";

type AppState = {
  config: LocalSetupConfig;
  sessionId: string | null;
  messages: ChatMessage[];
  connectionState: ConnectionState;
  lastError: string | null;
  lastHeartbeat: HealthHeartbeatPayload["services"];
  setConfig: (nextConfig: LocalSetupConfig) => void;
  updateConfig: (patch: Partial<LocalSetupConfig>) => void;
  setSessionId: (sessionId: string) => void;
  clearMessages: () => void;
  addMessage: (message: ChatMessage) => void;
  addUserMessage: (content: string, transport: ChatTransportMode) => void;
  appendAssistantChunk: (chunk: string, transport: ChatTransportMode) => void;
  finalizeAssistantMessage: (
    content: string | undefined,
    transport: ChatTransportMode,
    status?: ChatMessageStatus,
  ) => void;
  setConnectionState: (state: ConnectionState) => void;
  setLastError: (message: string | null) => void;
  setHeartbeat: (services: HealthHeartbeatPayload["services"]) => void;
};

function updateSetupConfig(nextConfig: LocalSetupConfig) {
  saveSetupConfig(nextConfig);
  return nextConfig;
}

export const useAppStore = create<AppState>((set) => ({
  config: loadSetupConfig(),
  sessionId: null,
  messages: [],
  connectionState: "idle",
  lastError: null,
  lastHeartbeat: [],
  setConfig: (nextConfig) =>
    set(() => ({
      config: updateSetupConfig(nextConfig),
    })),
  updateConfig: (patch) =>
    set((state) => ({
      config: updateSetupConfig({ ...state.config, ...patch }),
    })),
  setSessionId: (sessionId) => set(() => ({ sessionId })),
  clearMessages: () => set(() => ({ messages: [] })),
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  addUserMessage: (content, transport) =>
    set((state) => ({
      messages: [...state.messages, createChatMessage("user", content, transport)],
    })),
  appendAssistantChunk: (chunk, transport) =>
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.status === "streaming") {
        const nextMessages = [...state.messages];
        nextMessages[nextMessages.length - 1] = {
          ...lastMessage,
          content: `${lastMessage.content}${chunk}`,
        };
        return { messages: nextMessages };
      }

      return {
        messages: [
          ...state.messages,
          createChatMessage("assistant", chunk, transport, "streaming"),
        ],
      };
    }),
  finalizeAssistantMessage: (content, transport, status = "complete") =>
    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.status === "streaming") {
        const nextMessages = [...state.messages];
        nextMessages[nextMessages.length - 1] = {
          ...lastMessage,
          content: content ?? lastMessage.content,
          status,
        };
        return { messages: nextMessages };
      }

      if (!content) {
        return { messages: state.messages };
      }

      return {
        messages: [
          ...state.messages,
          createChatMessage("assistant", content, transport, status),
        ],
      };
    }),
  setConnectionState: (connectionState) => set(() => ({ connectionState })),
  setLastError: (lastError) => set(() => ({ lastError })),
  setHeartbeat: (lastHeartbeat) => set(() => ({ lastHeartbeat })),
}));
