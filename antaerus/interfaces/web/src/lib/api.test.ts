// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { fetchChatSessionHistory, fetchDevToken } from "@/lib/api";

describe("api helpers", () => {
  it("récupère un JWT de développement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "jwt-dev" }),
      }),
    );

    const response = await fetchDevToken("http://localhost:8080", "user");
    expect(response.token).toBe("jwt-dev");
  });

  it("charge l'historique d'une session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sessionId: "session-1",
          messages: [],
        }),
      }),
    );

    const response = await fetchChatSessionHistory(
      "http://localhost:8080",
      "session-1",
    );
    expect(response.sessionId).toBe("session-1");
  });
});
