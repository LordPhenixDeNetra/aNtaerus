// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMissions } from "@/hooks/useMissions";
import type { Mission } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

function missionOf(status: Mission["status"] = "planned"): Mission {
  return {
    id: "m1",
    title: "Exemple",
    userRequest: "Exemple requete",
    status,
    createdAt: "2026-08-24T00:00:00Z",
    updatedAt: "2026-08-24T00:00:00Z",
    steps: [{ id: "s0", index: 0, title: "Etape", status: "pending" }],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useAppStore.setState({
    missions: [],
    missionsTotal: 0,
    missionsLoading: false,
    missionsLastError: null,
    missionsFilter: {},
  });
});

describe("useMissions", () => {
  it("fetch missions a la creation via fetch listMissions", async () => {
    const missions = [missionOf("planned")];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: missions, total: missions.length }), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    const { result } = renderHook(() => useMissions());
    await waitFor(() => expect(result.current.missionsLoading).toBe(false));
    expect(result.current.missions).toHaveLength(1);
    expect(result.current.missionsTotal).toBe(1);
    expect(result.current.missions[0]?.id).toBe("m1");
  });

  it("mergeMissionUpdate fusionne statut et step via store", async () => {
    const missions = [missionOf("planned")];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: missions, total: missions.length }), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    const { result } = renderHook(() => useMissions());
    await waitFor(() => expect(result.current.missions).toHaveLength(1));
    await act(async () => {
      result.current.mergeMissionUpdate({
        missionId: "m1",
        status: "running",
        stepIndex: 0,
        stepId: "s0",
        stepStatus: "running",
      });
    });
    const stored = useAppStore.getState().missions[0];
    expect(stored?.status).toBe("running");
    expect(stored?.steps[0]?.status).toBe("running");
  });

  it("setMissionsFilter met a jour le filtre", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ items: [], total: 0 }), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );
    const { result } = renderHook(() => useMissions());
    await act(async () => {
      result.current.setMissionsFilter({ status: "failed", limit: 5 });
    });
    expect(result.current.missionsFilter.status).toBe("failed");
    expect(result.current.missionsFilter.limit).toBe(5);
  });
});
