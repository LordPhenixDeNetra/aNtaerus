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

  readyState = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];
  listeners: Record<string, Array<(event?: MessageEvent) => void>> = {};

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.listeners.open?.forEach((listener) => listener());
    });
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
}

describe("useWebSocket", () => {
  beforeEach(() => {
    window.localStorage.clear();
    MockWebSocket.instances = [];
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
    });

    const { result } = renderHook(() => useWebSocket("session-1"));

    await act(async () => {
      await result.current.connect();
    });

    expect(useAppStore.getState().config.websocketDevToken).toBe("generated-token");
  });
});
