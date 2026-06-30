// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETUP_CONFIG } from "@/lib/setup";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAppStore } from "@/store/useAppStore";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static autoOpen = true;

  readyState = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];
  listeners: Record<string, Array<(event?: MessageEvent) => void>> = {};

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
    if (MockWebSocket.autoOpen) {
      queueMicrotask(() => {
        this.emitOpen();
      });
    }
  }

  addEventListener(
    type: string,
    listener: (event?: MessageEvent) => void,
  ) {
    this.listeners[type] ??= [];
    this.listeners[type].push(listener);
  }

  send(payload: string) {
    this.sentMessages.push(payload);
  }

  close() {
    this.listeners.close?.forEach((listener) => listener());
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.listeners.open?.forEach((listener) => listener());
  }
}

describe("useWebSocket", () => {
  beforeEach(() => {
    window.localStorage.clear();
    MockWebSocket.instances = [];
    MockWebSocket.autoOpen = true;
    vi.stubGlobal("WebSocket", MockWebSocket);
    useAppStore.setState({
      config: {
        ...DEFAULT_SETUP_CONFIG,
        gatewayBaseUrl: "http://localhost:8080",
        websocketDevToken: "dev-token",
      },
      sessionId: "session-1",
      messages: [],
      connectionState: "idle",
      lastError: null,
      lastHeartbeat: [],
      voiceMode: "idle",
      voiceSessionActive: false,
      voiceTranscript: "",
      voiceVADState: null,
      voiceLastUpdatedAt: null,
    });
  });

  it("sérialise un message chat.message", async () => {
    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.sendChatMessage("Bonjour");
    });

    const instance = MockWebSocket.instances[0];
    expect(instance.url).toContain("/api/v1/ws?token=dev-token");
    expect(instance.sentMessages).toHaveLength(1);

    const payload = JSON.parse(instance.sentMessages[0]) as {
      type: string;
      payload: { sessionId: string; message: string };
    };
    expect(payload.type).toBe("chat.message");
    expect(payload.payload.sessionId).toBe("session-1");
    expect(payload.payload.message).toBe("Bonjour");
  });

  it("génère un JWT de développement si absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "generated-token" }),
      }),
    );
    useAppStore.setState({
      config: {
        ...DEFAULT_SETUP_CONFIG,
        gatewayBaseUrl: "http://localhost:8080",
        websocketDevToken: "",
      },
      sessionId: "session-1",
      messages: [],
      connectionState: "idle",
      lastError: null,
      lastHeartbeat: [],
      voiceMode: "idle",
      voiceSessionActive: false,
      voiceTranscript: "",
      voiceVADState: null,
      voiceLastUpdatedAt: null,
    });

    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.connect();
    });

    expect(useAppStore.getState().config.websocketDevToken).toBe("generated-token");
  });

  it("sérialise une commande voice.start", async () => {
    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.sendVoiceStart();
    });

    const instance = MockWebSocket.instances[0];
    const payload = JSON.parse(instance.sentMessages[0]) as {
      type: string;
      payload: { sessionId: string };
    };

    expect(payload.type).toBe("voice.start");
    expect(payload.payload.sessionId).toBe("session-1");
    expect(useAppStore.getState().voiceMode).toBe("listening");
    expect(useAppStore.getState().voiceSessionActive).toBe(true);
  });

  it("sérialise une commande voice.stop", async () => {
    useAppStore.setState({
      voiceMode: "speaking",
      voiceSessionActive: true,
      voiceTranscript: "Bonjour",
      voiceVADState: "speaking",
      voiceLastUpdatedAt: Date.now(),
    });
    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.sendVoiceStop();
    });

    const instance = MockWebSocket.instances[0];
    const payload = JSON.parse(instance.sentMessages[0]) as {
      type: string;
      payload: { sessionId: string };
    };

    expect(payload.type).toBe("voice.stop");
    expect(useAppStore.getState().voiceMode).toBe("idle");
    expect(useAppStore.getState().voiceTranscript).toBe("");
  });

  it("consomme voice.transcript et voice.vad_state", async () => {
    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.connect();
    });

    const instance = MockWebSocket.instances[0];
    await act(async () => {
      instance.listeners.message?.forEach((listener) =>
        listener({
          data: JSON.stringify({
            type: "voice.transcript",
            timestamp: new Date().toISOString(),
            payload: {
              sessionId: "session-1",
              transcript: "Salut en direct",
            },
          }),
        } as MessageEvent),
      );

      instance.listeners.message?.forEach((listener) =>
        listener({
          data: JSON.stringify({
            type: "voice.vad_state",
            timestamp: new Date().toISOString(),
            payload: {
              sessionId: "session-1",
              state: "speaking",
            },
          }),
        } as MessageEvent),
      );
    });

    expect(useAppStore.getState().voiceTranscript).toBe("Salut en direct");
    expect(useAppStore.getState().voiceVADState).toBe("speaking");
  });

  it("passe en mode speaking sur chat.token puis revient en listening sur chat.complete", async () => {
    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.sendVoiceStart();
    });

    const instance = MockWebSocket.instances[0];
    expect(useAppStore.getState().voiceSessionActive).toBe(true);
    await act(async () => {
      instance.listeners.message?.forEach((listener) =>
        listener({
          data: JSON.stringify({
            type: "chat.token",
            timestamp: new Date().toISOString(),
            payload: {
              sessionId: "session-1",
              token: "Bon",
            },
          }),
        } as MessageEvent),
      );
    });

    expect(useAppStore.getState().voiceMode).toBe("speaking");

    await act(async () => {
      instance.listeners.message?.forEach((listener) =>
        listener({
          data: JSON.stringify({
            type: "chat.complete",
            timestamp: new Date().toISOString(),
            payload: {
              sessionId: "session-1",
              message: "Bonjour",
            },
          }),
        } as MessageEvent),
      );
    });

    expect(useAppStore.getState().voiceMode).toBe("listening");
  });

  it("attend l'ouverture de la socket avant d'envoyer voice.start", async () => {
    MockWebSocket.autoOpen = false;
    const { result } = renderHook(() => useWebSocket("session-1"));

    let sent = false;
    const startPromise = act(async () => {
      const pending = result.current.sendVoiceStart().then((value) => {
        sent = value;
      });
      await Promise.resolve();
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].sentMessages).toHaveLength(0);
      MockWebSocket.instances[0].emitOpen();
      await pending;
    });

    await startPromise;

    const instance = MockWebSocket.instances[0];
    expect(sent).toBe(true);
    expect(instance.sentMessages).toHaveLength(1);
    expect(JSON.parse(instance.sentMessages[0]).type).toBe("voice.start");
  });

  it("réinitialise l'état voix sur une erreur runtime voix", async () => {
    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.sendVoiceStart();
    });

    const instance = MockWebSocket.instances[0];
    await act(async () => {
      instance.listeners.message?.forEach((listener) =>
        listener({
          data: JSON.stringify({
            type: "system.alert",
            timestamp: new Date().toISOString(),
            payload: {
              level: "error",
              message: "No active voice session for this sessionId",
            },
          }),
        } as MessageEvent),
      );
    });

    expect(useAppStore.getState().voiceMode).toBe("idle");
    expect(useAppStore.getState().voiceSessionActive).toBe(false);
  });
});
