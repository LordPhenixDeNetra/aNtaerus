import { create } from "zustand";

import {
  createChatMessage,
  type ChatMessage,
  type ChatMessageStatus,
} from "@/lib/chat";
import type {
  CollectorInfo,
  CuratorPatch,
  CuratorReport,
  Initiative,
  Mission,
} from "@/lib/api";
import { loadSetupConfig, saveSetupConfig } from "@/lib/storage";
import {
  type ChatTransportMode,
  type LocalSetupConfig,
} from "@/lib/setup";
import type {
  HealthHeartbeatPayload,
  InitiativeUpdatePayload,
} from "@/lib/ws";

export type ConnectionState = "idle" | "connecting" | "connected" | "error";
export type VoiceMode = "idle" | "listening" | "speaking";
export type VoiceVADState = "speaking" | "silence" | null;
export type VoiceWakeState = "waiting" | "armed" | null;

type MissionsFilter = {
  sessionId?: string;
  status?: Mission["status"];
  limit?: number;
};

type AppState = {
  config: LocalSetupConfig;
  sessionId: string | null;
  messages: ChatMessage[];
  connectionState: ConnectionState;
  lastError: string | null;
  lastHeartbeat: HealthHeartbeatPayload["services"];
  voiceMode: VoiceMode;
  voiceSessionActive: boolean;
  voiceTranscript: string;
  voiceVADState: VoiceVADState;
  voiceWakeState: VoiceWakeState;
  voiceLastUpdatedAt: number | null;
  missions: Mission[];
  missionsTotal: number;
  missionsLoading: boolean;
  missionsLastError: string | null;
  missionsFilter: MissionsFilter;
  collectors: CollectorInfo[];
  collectorsLoading: boolean;
  collectorsLastError: string | null;
  initiatives: Initiative[];
  initiativesTotal: number;
  initiativesLoading: boolean;
  initiativesLastError: string | null;
  globalAutonomyLevel: number;
  lastCuratorReport: CuratorReport | null;
  curatorPatches: CuratorPatch[];
  setConfig: (nextConfig: LocalSetupConfig) => void;
  updateConfig: (patch: Partial<LocalSetupConfig>) => void;
  setSessionId: (sessionId: string) => void;
  clearMessages: () => void;
  replaceMessages: (messages: ChatMessage[]) => void;
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
  setVoiceMode: (mode: VoiceMode) => void;
  setVoiceSessionActive: (active: boolean) => void;
  setVoiceTranscript: (transcript: string) => void;
  setVoiceVADState: (state: VoiceVADState) => void;
  setVoiceWakeState: (state: VoiceWakeState) => void;
  resetVoiceState: () => void;
  setMissionsFilter: (filter: Partial<MissionsFilter>) => void;
  setMissions: (items: Mission[], total: number) => void;
  setMissionsLoading: (loading: boolean) => void;
  setMissionsError: (error: string | null) => void;
  addOrUpdateMission: (next: Mission) => void;
  mergeMissionUpdate: (update: {
    missionId: string;
    status?: string;
    stepIndex?: number;
    stepId?: string;
    stepStatus?: string;
    stepResultJson?: string;
    error?: string;
  }) => void;
  setCollectors: (items: CollectorInfo[]) => void;
  setCollectorsLoading: (loading: boolean) => void;
  setCollectorsError: (error: string | null) => void;
  setInitiatives: (items: Initiative[], total: number) => void;
  setInitiativesLoading: (loading: boolean) => void;
  setInitiativesError: (error: string | null) => void;
  addOrUpdateInitiative: (next: Initiative) => void;
  mergeInitiativeUpdate: (update: InitiativeUpdatePayload) => void;
  setGlobalAutonomyLevel: (level: number) => void;
  setLastCuratorReport: (report: CuratorReport | null) => void;
  setCuratorPatches: (patches: CuratorPatch[]) => void;
  addOrUpdateCuratorPatch: (patch: CuratorPatch) => void;
};

function updateSetupConfig(nextConfig: LocalSetupConfig) {
  saveSetupConfig(nextConfig);
  return nextConfig;
}

export const useAppStore = create<AppState>((set, get) => ({
  config: loadSetupConfig(),
  sessionId: null,
  messages: [],
  connectionState: "idle",
  lastError: null,
  lastHeartbeat: [],
  voiceMode: "idle",
  voiceSessionActive: false,
  voiceTranscript: "",
  voiceVADState: null,
  voiceWakeState: null,
  voiceLastUpdatedAt: null,
  missions: [],
  missionsTotal: 0,
  missionsLoading: false,
  missionsLastError: null,
  missionsFilter: {},
  collectors: [],
  collectorsLoading: false,
  collectorsLastError: null,
  initiatives: [],
  initiativesTotal: 0,
  initiativesLoading: false,
  initiativesLastError: null,
  globalAutonomyLevel: 1,
  lastCuratorReport: null,
  curatorPatches: [],
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
  replaceMessages: (messages) => set(() => ({ messages })),
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
  setVoiceMode: (voiceMode) =>
    set(() => ({
      voiceMode,
      voiceLastUpdatedAt: Date.now(),
    })),
  setVoiceSessionActive: (voiceSessionActive) =>
    set(() => ({
      voiceSessionActive,
      voiceLastUpdatedAt: Date.now(),
    })),
  setVoiceTranscript: (voiceTranscript) =>
    set(() => ({
      voiceTranscript,
      voiceLastUpdatedAt: Date.now(),
    })),
  setVoiceVADState: (voiceVADState) =>
    set(() => ({
      voiceVADState,
      voiceLastUpdatedAt: Date.now(),
    })),
  setVoiceWakeState: (voiceWakeState) =>
    set(() => ({
      voiceWakeState,
      voiceLastUpdatedAt: Date.now(),
    })),
  resetVoiceState: () =>
    set(() => ({
      voiceMode: "idle",
      voiceSessionActive: false,
      voiceTranscript: "",
      voiceVADState: null,
      voiceWakeState: null,
      voiceLastUpdatedAt: null,
    })),
  setMissionsFilter: (filter) =>
    set((state) => ({ missionsFilter: { ...state.missionsFilter, ...filter } })),
  setMissions: (items, total) =>
    set(() => ({ missions: items, missionsTotal: total })),
  setMissionsLoading: (missionsLoading) => set(() => ({ missionsLoading })),
  setMissionsError: (missionsLastError) => set(() => ({ missionsLastError })),
  addOrUpdateMission: (next) =>
    set((state) => {
      const idx = state.missions.findIndex((m) => m.id === next.id);
      const copy = [...state.missions];
      if (idx === -1) {
        copy.unshift(next);
        return { missions: copy, missionsTotal: state.missionsTotal + 1 };
      }
      copy[idx] = { ...copy[idx], ...next };
      return { missions: copy };
    }),
  mergeMissionUpdate: (update) =>
    set((state) => {
      const idx = state.missions.findIndex((m) => m.id === update.missionId);
      if (idx === -1) {
        return state;
      }
      const copy = [...state.missions];
      const mission = { ...copy[idx] };
      if (update.status) {
        mission.status = update.status as Mission["status"];
      }
      if (update.error !== undefined) {
        mission.error = update.error;
      }
      if (update.stepIndex !== undefined || update.stepId) {
        const stepIdx =
          update.stepIndex !== undefined
            ? mission.steps.findIndex((step) => step.index === update.stepIndex)
            : mission.steps.findIndex((step) => step.id === update.stepId);
        if (stepIdx !== -1) {
          const stepsCopy = [...mission.steps];
          const step = { ...stepsCopy[stepIdx] };
          if (update.stepStatus) {
            step.status = update.stepStatus as Mission["steps"][number]["status"];
          }
          if (update.stepResultJson) {
            try {
              step.result = JSON.parse(update.stepResultJson) as typeof step.result;
            } catch {
              // ignore malformed result payload
            }
          }
          stepsCopy[stepIdx] = step;
          mission.steps = stepsCopy;
        }
      }
      mission.updatedAt = new Date().toISOString();
      copy[idx] = mission;
      return { missions: copy };
    }),
  setCollectors: (items) => set(() => ({ collectors: items })),
  setCollectorsLoading: (collectorsLoading) => set(() => ({ collectorsLoading })),
  setCollectorsError: (collectorsLastError) => set(() => ({ collectorsLastError })),
  setInitiatives: (items, total) =>
    set(() => ({ initiatives: items, initiativesTotal: total })),
  setInitiativesLoading: (initiativesLoading) => set(() => ({ initiativesLoading })),
  setInitiativesError: (initiativesLastError) => set(() => ({ initiativesLastError })),
  addOrUpdateInitiative: (next) =>
    set((state) => {
      const idx = state.initiatives.findIndex((i) => i.id === next.id);
      const copy = [...state.initiatives];
      if (idx === -1) {
        copy.unshift(next);
        return {
          initiatives: copy,
          initiativesTotal: state.initiativesTotal + 1,
        };
      }
      copy[idx] = { ...copy[idx], ...next };
      return { initiatives: copy };
    }),
  mergeInitiativeUpdate: (update) =>
    set((state) => {
      const idx = state.initiatives.findIndex((i) => i.id === update.initiativeId);
      if (idx === -1) {
        return state;
      }
      const copy = [...state.initiatives];
      const initiative = { ...copy[idx] };
      if (update.status) {
        initiative.status = update.status as Initiative["status"];
      }
      if (update.autonomyLevel !== undefined) {
        initiative.autonomyLevel = update.autonomyLevel ?? 0;
      }
      if (update.budgetTokens !== undefined) {
        initiative.budgetTokens = update.budgetTokens;
      }
      if (update.budgetTokensUsed !== undefined) {
        initiative.budgetTokensUsed = update.budgetTokensUsed;
      }
      if (update.ranAt !== undefined) {
        initiative.ranAt = update.ranAt;
      }
      if (update.completedAt !== undefined) {
        initiative.completedAt = update.completedAt;
      }
      if (update.error !== undefined) {
        initiative.error = update.error;
      }
      initiative.updatedAt = update.updatedAt || new Date().toISOString();
      copy[idx] = initiative;
      return { initiatives: copy };
    }),
  setGlobalAutonomyLevel: (globalAutonomyLevel) =>
    set(() => ({ globalAutonomyLevel: Math.max(0, Math.min(5, globalAutonomyLevel)) })),
  setLastCuratorReport: (lastCuratorReport) => set(() => ({ lastCuratorReport })),
  setCuratorPatches: (curatorPatches) => set(() => ({ curatorPatches })),
  addOrUpdateCuratorPatch: (patch) =>
    set((state) => {
      const idx = state.curatorPatches.findIndex((p) => p.id === patch.id);
      const copy = [...state.curatorPatches];
      if (idx === -1) {
        copy.unshift(patch);
        return { curatorPatches: copy };
      }
      copy[idx] = { ...copy[idx], ...patch };
      return { curatorPatches: copy };
    }),
}));
