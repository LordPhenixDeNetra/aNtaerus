// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useSession } from "@/hooks/useSession";
import { DEFAULT_SETUP_CONFIG } from "@/lib/setup";
import { useAppStore } from "@/store/useAppStore";

describe("useSession", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAppStore.setState({
      config: DEFAULT_SETUP_CONFIG,
      sessionId: null,
      messages: [],
      connectionState: "idle",
      lastError: null,
      lastHeartbeat: [],
    });
  });

  it("génère une session persistée localement", () => {
    const { result } = renderHook(() => useSession());

    expect(result.current.sessionId).not.toBe("");
    expect(window.localStorage.getItem("antaerus.session")).toBe(
      result.current.sessionId,
    );
  });
});
