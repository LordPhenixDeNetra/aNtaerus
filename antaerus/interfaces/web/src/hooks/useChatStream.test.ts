// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStream } from "@/hooks/useChatStream";
import { DEFAULT_SETUP_CONFIG } from "@/lib/setup";
import { useAppStore } from "@/store/useAppStore";

describe("useChatStream", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState({
      config: {
        ...DEFAULT_SETUP_CONFIG,
        brainBaseUrl: "http://localhost:8000",
        chatTransport: "sse-dev",
      },
      sessionId: "session-1",
      messages: [],
      connectionState: "idle",
      lastError: null,
      lastHeartbeat: [],
    });
  });

  it("parse un flux SSE simple", async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                'event: token\ndata: {"text":"Bon"}\n\n' +
                  'event: complete\ndata: {"text":"Bonjour"}\n\n',
              ),
            );
            controller.close();
          },
        }),
      }),
    );

    const { result } = renderHook(() => useChatStream());

    await act(async () => {
      await result.current.streamPrompt("Bonjour");
    });

    const messages = useAppStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Bonjour");
    expect(messages[0].status).toBe("complete");
  });
});
