import { useCallback, useRef, useState } from "react";

import { useAppStore } from "@/store/useAppStore";

type SSEEvent = {
  event: string;
  data: Record<string, unknown>;
};

function parseSSEBlock(block: string): SSEEvent | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  const eventLine = lines.find((line) => line.startsWith("event:"));
  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!eventLine || !dataLine) {
    return null;
  }

  try {
    return {
      event: eventLine.replace("event:", "").trim(),
      data: JSON.parse(dataLine.replace("data:", "").trim()) as Record<
        string,
        unknown
      >,
    };
  } catch {
    return null;
  }
}

export function useChatStream() {
  const brainBaseUrl = useAppStore((state) => state.config.brainBaseUrl);
  const appendAssistantChunk = useAppStore((state) => state.appendAssistantChunk);
  const finalizeAssistantMessage = useAppStore(
    (state) => state.finalizeAssistantMessage,
  );
  const setLastError = useAppStore((state) => state.setLastError);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const streamPrompt = useCallback(
    async (prompt: string) => {
      cancelStream();
      setLastError(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(new URL("/llm/stream", brainBaseUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Streaming SSE indisponible.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            const event = parseSSEBlock(block);
            if (!event) {
              continue;
            }

            if (event.event === "token") {
              appendAssistantChunk(String(event.data.text ?? ""), "sse-dev");
            } else if (event.event === "complete") {
              finalizeAssistantMessage(
                String(event.data.text ?? ""),
                "sse-dev",
              );
            } else if (event.event === "error") {
              finalizeAssistantMessage(
                String(event.data.message ?? "Erreur de streaming."),
                "sse-dev",
                "error",
              );
            }
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          const message =
            error instanceof Error ? error.message : "Erreur inconnue de streaming.";
          setLastError(message);
          finalizeAssistantMessage(message, "sse-dev", "error");
        }
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      appendAssistantChunk,
      brainBaseUrl,
      cancelStream,
      finalizeAssistantMessage,
      setLastError,
    ],
  );

  return {
    isStreaming,
    streamPrompt,
    cancelStream,
  };
}
