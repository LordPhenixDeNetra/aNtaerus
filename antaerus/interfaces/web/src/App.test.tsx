// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
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
