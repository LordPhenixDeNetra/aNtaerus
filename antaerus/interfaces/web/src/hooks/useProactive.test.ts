// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProactive } from "@/hooks/useProactive";
import type { Initiative } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function initiativeOf(
  status: Initiative["status"] = "pending",
  id = "i1",
): Initiative {
  return {
    id,
    title: "Exemple initiative",
    description: null,
    collectorSource: null,
    triggerType: "manual",
    triggerConfig: {},
    status,
    autonomyLevel: 1,
    budgetTokens: 1000,
    budgetTokensUsed: 0,
    alertPayload: null,
    ranAt: null,
    completedAt: null,
    error: null,
    createdAt: "2026-08-24T00:00:00Z",
    updatedAt: "2026-08-24T00:00:00Z",
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useAppStore.setState({
    collectors: [],
    collectorsLoading: false,
    collectorsLastError: null,
    initiatives: [],
    initiativesTotal: 0,
    initiativesLoading: false,
    initiativesLastError: null,
    globalAutonomyLevel: 1,
    lastCuratorReport: null,
    curatorPatches: [],
  });
});

function makeURLResponder(responses: {
  collectors?: unknown;
  initiatives?: unknown;
  curatorReport?: unknown;
  curatorPatches?: unknown;
  schedulerStatus?: unknown;
  fallback?: unknown;
}) {
  return vi.fn((input: RequestInfo | URL) => {
    let url: string;
    if (typeof input === "string") {
      url = input;
    } else if ("url" in input && typeof (input as Request).url === "string") {
      url = (input as Request).url;
    } else {
      url = String(input);
    }
    let data: unknown = responses.fallback ?? {};
    if (url.includes("/proactive/collectors") && responses.collectors !== undefined) {
      data = responses.collectors;
    } else if (url.includes("/proactive/initiatives") && responses.initiatives !== undefined) {
      data = responses.initiatives;
    } else if (
      url.includes("/proactive/curator/report") &&
      responses.curatorReport !== undefined
    ) {
      data = responses.curatorReport;
    } else if (
      url.includes("/proactive/curator/patches") &&
      responses.curatorPatches !== undefined
    ) {
      data = responses.curatorPatches;
    } else if (
      url.includes("/proactive/scheduler/status") &&
      responses.schedulerStatus !== undefined
    ) {
      data = responses.schedulerStatus;
    }
    const init: ResponseInit =
      data === null
        ? { status: 404, headers: { "Content-Type": "application/json" } }
        : { headers: { "Content-Type": "application/json" } };
    return Promise.resolve(new Response(JSON.stringify(data ?? null), init));
  });
}

describe("useProactive", () => {
  it("fetch collectors et initiatives via polling 10s", async () => {
    const collectors = [
      { name: "weather", enabled: true, lastRanAt: null, lastStatus: null, lastError: null },
    ];
    const initiatives = [initiativeOf("pending", "i1")];
    vi.stubGlobal(
      "fetch",
      makeURLResponder({
        collectors,
        initiatives: { items: initiatives, total: initiatives.length },
        curatorReport: null,
        curatorPatches: { items: [], total: 0 },
        schedulerStatus: { running: false, cronHour: 2 },
      }),
    );

    const { result } = renderHook(() => useProactive());
    await waitFor(() => expect(result.current.collectors).toHaveLength(1));
    expect(result.current.initiatives).toHaveLength(1);
    expect(result.current.initiativesTotal).toBe(1);
    expect(result.current.globalAutonomyLevel).toBe(1);
  });

  it("mergeInitiativeUpdate fusionne statut/autonomie via store", async () => {
    const initiatives = [initiativeOf("pending", "i-merge")];
    vi.stubGlobal(
      "fetch",
      makeURLResponder({
        collectors: [],
        initiatives: { items: initiatives, total: initiatives.length },
        curatorReport: null,
        curatorPatches: { items: [], total: 0 },
        schedulerStatus: { running: false, cronHour: 2 },
      }),
    );
    const { result } = renderHook(() => useProactive());
    await waitFor(() =>
      expect(result.current.initiatives.find((i) => i.id === "i-merge")).toBeDefined(),
    );
    await act(async () => {
      result.current.mergeInitiativeUpdate({
        initiativeId: "i-merge",
        status: "running",
        autonomyLevel: 3,
        budgetTokens: 5000,
        budgetTokensUsed: 42,
        updatedAt: "2026-08-24T12:00:00Z",
      });
    });
    const stored = useAppStore
      .getState()
      .initiatives.find((i) => i.id === "i-merge");
    expect(stored?.status).toBe("running");
    expect(stored?.autonomyLevel).toBe(3);
    expect(stored?.budgetTokens).toBe(5000);
    expect(stored?.budgetTokensUsed).toBe(42);
  });

  it("setGlobalAutonomyLevel borne la valeur dans [0,5]", async () => {
    vi.stubGlobal(
      "fetch",
      makeURLResponder({
        collectors: [],
        initiatives: { items: [], total: 0 },
        curatorReport: null,
        curatorPatches: { items: [], total: 0 },
        schedulerStatus: { running: false, cronHour: 2 },
      }),
    );
    const { result } = renderHook(() => useProactive());
    await act(async () => {
      result.current.setGlobalAutonomyLevel(999);
    });
    expect(result.current.globalAutonomyLevel).toBe(5);
    await act(async () => {
      result.current.setGlobalAutonomyLevel(-10);
    });
    expect(result.current.globalAutonomyLevel).toBe(0);
  });
});
