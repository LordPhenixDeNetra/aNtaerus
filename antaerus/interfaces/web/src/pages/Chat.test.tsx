// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Chat from "@/pages/Chat";
import { DEFAULT_SETUP_CONFIG } from "@/lib/setup";
import { useAppStore } from "@/store/useAppStore";

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.OPEN;

  addEventListener() {}

  close() {}

  send() {}
}

describe("Chat", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/system/status")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              product: "aNtaerus",
              phase: "foundation",
              environment: "test",
              services: [],
              capabilities: [],
            }),
          });
        }

        if (url.includes("/api/v1/chat/sessions/session-1")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "session-1",
              messages: [
                {
                  id: "msg-1",
                  sessionId: "session-1",
                  role: "assistant",
                  content: "Historique persiste",
                  createdAt: "2026-01-01T00:00:00Z",
                },
              ],
            }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            defaultProvider: "ollama",
            providers: [{ name: "deepseek", model: "deepseek/deepseek-chat" }],
          }),
        });
      }),
    );

    useAppStore.setState({
      config: {
        ...DEFAULT_SETUP_CONFIG,
        gatewayBaseUrl: "http://localhost:8080",
        websocketDevToken: "dev-token",
        chatTransport: "ws",
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

  it("hydrate l'historique de la session active", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Historique persiste")).toBeInTheDocument();
    });
  });

  it("affiche les contrôles voix en mode ws", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Chat />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Démarrer la voix/i }).length,
      ).toBeGreaterThan(0);
    });
  });
});
