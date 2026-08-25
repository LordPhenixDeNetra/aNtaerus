// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CommandCenter from "@/pages/CommandCenter";

vi.mock("@/hooks/useProactive", () => ({
  useProactive: () => ({
    collectors: [
      { name: "weather", enabled: true, lastRanAt: null, lastStatus: null, lastError: null },
      { name: "system", enabled: true, lastRanAt: "2026-08-24T00:00:00Z", lastStatus: "success", lastError: null },
    ],
    collectorsLoading: false,
    collectorsLastError: null,
    initiatives: [
      {
        id: "i-cc-1",
        title: "Init page",
        description: null,
        collectorSource: null,
        triggerType: "manual",
        triggerConfig: {},
        status: "pending",
        autonomyLevel: 2,
        budgetTokens: 100,
        budgetTokensUsed: 0,
        alertPayload: null,
        ranAt: null,
        completedAt: null,
        error: null,
        createdAt: "2026-08-24T00:00:00Z",
        updatedAt: "2026-08-24T00:00:00Z",
      },
    ],
    initiativesTotal: 1,
    initiativesLoading: false,
    initiativesLastError: null,
    globalAutonomyLevel: 1,
    lastCuratorReport: {
      id: "rep-id-1",
      generatedAt: "2026-08-24T02:00:00Z",
      durationMs: 120,
      factsAdded: 12,
      factsContradictory: 0,
      unusedSkills: [],
      unusedTools: [],
      estimatedSpendTokens: 0,
      estimatedCostUsd: 0,
      topPatchesCount: 2,
      notes: ["Note 1", "Note 2"],
      patches: [],
    },
    curatorPatches: [
      {
        id: "p1",
        reportId: "rep-id-1",
        targetType: "initiative",
        targetRef: "i-cc-1",
        title: "Augmenter budget",
        rationale: "Budget trop bas",
        decision: "proposed",
        requiresHuman: true,
        decidedBy: null,
        decidedAt: null,
        createdAt: "2026-08-24T02:00:01Z",
      },
    ],
    actionLoading: null,
    refreshCollectors: vi.fn(),
    refreshInitiatives: vi.fn(),
    refreshCurator: vi.fn(),
    refreshAll: vi.fn(),
    runCollector: vi.fn(),
    runAllCollectors: vi.fn(),
    create: vi.fn(),
    run: vi.fn(),
    patch: vi.fn(),
    setGlobalAutonomyLevel: vi.fn(),
    mergeInitiativeUpdate: vi.fn(),
    runCurator: vi.fn(),
    approvePatch: vi.fn(),
    rejectPatch: vi.fn(),
    getScheduler: vi.fn(async () => ({ running: true, cronHour: 2 })),
    startScheduler: vi.fn(),
    stopScheduler: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CommandCenter", () => {
  it("affiche le titre, panel collecteurs, panel initiatives, panel curator", () => {
    render(
      <MemoryRouter>
        <CommandCenter />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/Moteur proactif : collecteurs/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("collectors-panel")).toBeInTheDocument();
    expect(screen.getByTestId("initiatives-panel")).toBeInTheDocument();
    expect(screen.getByTestId("curator-panel")).toBeInTheDocument();
  });

  it("rend le formulaire de creation d'initiative", () => {
    render(
      <MemoryRouter>
        <CommandCenter />
      </MemoryRouter>,
    );
    const forms = screen.queryAllByTestId("create-initiative-form");
    expect(forms.length).toBeGreaterThan(0);
    expect(screen.getByText("Creer l'initiative")).toBeInTheDocument();
  });

  it("hydrate les listes collecteurs, initiatives, patches depuis le mock", () => {
    render(
      <MemoryRouter>
        <CommandCenter />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("collector-card-weather")).toBeInTheDocument();
    expect(screen.getByTestId("collector-card-system")).toBeInTheDocument();
    expect(screen.getByTestId("initiative-card-i-cc-1")).toBeInTheDocument();
    expect(screen.getByTestId("patch-card-p1")).toBeInTheDocument();
    expect(screen.getByText("Resume nuit")).toBeInTheDocument();
  });
});
