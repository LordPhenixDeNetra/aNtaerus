// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InitiativeCard from "@/components/InitiativeCard";
import type { Initiative } from "@/lib/api";

function buildInitiative(
  partial: Partial<Initiative> = {},
  id = "i1",
): Initiative {
  const base: Initiative = {
    id,
    title: "Exemple initiative",
    description: "Desc exemple",
    collectorSource: null,
    triggerType: "manual",
    triggerConfig: {},
    status: "pending",
    autonomyLevel: 1,
    budgetTokens: 1000,
    budgetTokensUsed: 200,
    alertPayload: null,
    ranAt: null,
    completedAt: null,
    error: null,
    createdAt: "2026-08-24T00:00:00Z",
    updatedAt: "2026-08-24T00:00:00Z",
  };
  return { ...base, ...partial };
}

describe("InitiativeCard", () => {
  it("rend le titre et badge de statut en couleur", () => {
    render(
      <InitiativeCard
        initiative={buildInitiative({ status: "running" }, "i-status")}
      />,
    );
    expect(screen.getByText("Exemple initiative")).toBeInTheDocument();
    const badge = screen.getByTestId("status-badge-i-status");
    expect(badge.textContent?.toLowerCase()).toContain("running");
    expect(badge.className).toContain("bg-sky-500/20");
  });

  it("affiche la barre de budget tokens avec pourcentage correct", () => {
    render(
      <InitiativeCard
        initiative={buildInitiative(
          { budgetTokens: 100, budgetTokensUsed: 25 },
          "i-budget",
        )}
      />,
    );
    expect(screen.getByText("25/100")).toBeInTheDocument();
    const bar = screen.getByTestId("budget-bar-i-budget") as HTMLDivElement;
    expect(bar.style.width).toBe("25%");
  });

  it("active le bouton run pour les statuts pending/queued/failed/rejected", () => {
    const { rerender } = render(
      <InitiativeCard
        initiative={buildInitiative({ status: "pending" }, "i-run")}
      />,
    );
    expect(screen.getByTestId("run-btn-i-run")).toBeEnabled();

    rerender(
      <InitiativeCard
        initiative={buildInitiative({ status: "running" }, "i-run")}
      />,
    );
    expect(screen.getByTestId("run-btn-i-run")).toBeDisabled();
  });

  it("appelle onRun et onPatch aux clics des boutons", () => {
    const onRun = vi.fn();
    const onPatch = vi.fn();
    const init = buildInitiative(
      { status: "pending", autonomyLevel: 0 },
      "i-cb",
    );
    render(
      <InitiativeCard
        initiative={init}
        onRun={onRun}
        onPatch={onPatch}
      />,
    );
    fireEvent.click(screen.getByTestId("run-btn-i-cb"));
    expect(onRun).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("patch-status-btn-i-cb"));
    expect(onPatch).toHaveBeenCalledWith(init, { status: "queued" });
    fireEvent.click(screen.getByTestId("toggle-autonomy-btn-i-cb"));
    expect(onPatch).toHaveBeenLastCalledWith(init, { autonomyLevel: 1 });
  });

  it("affiche le message d'erreur quand error est renseigne", () => {
    render(
      <InitiativeCard
        initiative={buildInitiative(
          { error: "Panique! Panique!" },
          "i-error",
        )}
      />,
    );
    expect(screen.getByText(/Panique/)).toBeInTheDocument();
  });
});
