// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useVAD } from "@/hooks/useVAD";
import { DEFAULT_SETUP_CONFIG } from "@/lib/setup";
import { useAppStore } from "@/store/useAppStore";

describe("useVAD", () => {
  beforeEach(() => {
    useAppStore.setState({
      config: DEFAULT_SETUP_CONFIG,
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

  it("retourne un niveau high quand l'assistant parle", () => {
    useAppStore.setState({
      voiceMode: "speaking",
      voiceSessionActive: true,
    });

    const { result } = renderHook(() => useVAD());
    expect(result.current.visualizerLevel).toBe("high");
  });

  it("retourne un niveau medium pendant l'écoute active", () => {
    useAppStore.setState({
      voiceMode: "listening",
      voiceSessionActive: true,
      voiceVADState: "speaking",
    });

    const { result } = renderHook(() => useVAD());
    expect(result.current.visualizerLevel).toBe("medium");
    expect(result.current.isSpeaking).toBe(true);
  });
});
