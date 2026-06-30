// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useVoiceStream } from "@/hooks/useVoiceStream";
import { DEFAULT_SETUP_CONFIG } from "@/lib/setup";
import { useAppStore } from "@/store/useAppStore";

describe("useVoiceStream", () => {
  beforeEach(() => {
    useAppStore.setState({
      config: DEFAULT_SETUP_CONFIG,
      sessionId: "session-1",
      messages: [],
      connectionState: "connected",
      lastError: null,
      lastHeartbeat: [],
      voiceMode: "idle",
      voiceSessionActive: false,
      voiceTranscript: "",
      voiceVADState: null,
      voiceLastUpdatedAt: null,
    });
  });

  it("active la voix en mode ws", async () => {
    const sendVoiceStart = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useVoiceStream({
        sessionId: "session-1",
        connectionState: "connected",
        sendVoiceStart,
        sendVoiceStop: vi.fn(),
        sendVoiceBargeIn: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startVoice();
    });

    expect(result.current.isVoiceAvailable).toBe(true);
    expect(sendVoiceStart).toHaveBeenCalled();
  });

  it("désactive la voix en mode sse-dev", () => {
    useAppStore.setState({
      config: {
        ...DEFAULT_SETUP_CONFIG,
        chatTransport: "sse-dev",
      },
    });

    const { result } = renderHook(() =>
      useVoiceStream({
        sessionId: "session-1",
        connectionState: "connected",
        sendVoiceStart: vi.fn(),
        sendVoiceStop: vi.fn(),
        sendVoiceBargeIn: vi.fn(),
      }),
    );

    expect(result.current.isVoiceAvailable).toBe(false);
    expect(result.current.statusLabel).toMatch(/SSE dev/i);
  });
});
