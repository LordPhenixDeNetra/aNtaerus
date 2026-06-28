// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

describe("App", () => {
  beforeEach(() => {
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

  it("affiche le dashboard de fondation", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Foundation Dashboard/i)).toBeInTheDocument();
    });
  });
});
