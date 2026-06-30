// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.OPEN;

  addEventListener() {}

  close() {}

  send() {}
}

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
              services: [
                {
                  name: "gateway_go",
                  status: "healthy",
                  version: "0.1.0",
                  port: 8080,
                  url: "http://localhost:8080",
                  checkedAt: new Date().toISOString(),
                },
              ],
              capabilities: [
                {
                  name: "gateway_go",
                  version: "0.1.0",
                  runtime: "go",
                  capabilities: ["healthcheck"],
                },
              ],
            }),
          });
        }

        if (url.includes("/api/v1/chat/sessions/")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              sessionId: "session-1",
              messages: [],
            }),
          });
        }

        if (url.includes("/api/v1/auth/dev-token")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ token: "jwt-dev-token" }),
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
  });

  it("affiche la page de chat par défaut", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Chat texte aNtaerus/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /Setup/i })).toBeInTheDocument();
  });
});
