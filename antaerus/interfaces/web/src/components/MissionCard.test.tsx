// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MissionCard from "@/components/MissionCard";
import type { Mission } from "@/lib/api";

function buildMission(partial: Partial<Mission> = {}, id = "m1"): Mission {
  const base: Mission = {
    id,
    title: "Mission example",
    userRequest: "Faire quelque chose",
    status: "planned",
    createdAt: "2026-08-24T00:00:00Z",
    updatedAt: "2026-08-24T00:00:00Z",
    steps: [
      { id: "s0", index: 0, title: "Etape 0", status: "pending" },
      { id: "s1", index: 1, title: "Etape 1", status: "completed" },
    ],
  };
  return { ...base, ...partial };
}

describe("MissionCard", () => {
  it("affiche progression et etats bouttons", () => {
    render(<MissionCard mission={buildMission({ status: "planned" }, "m-progress")} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByTestId("run-btn-m-progress")).toBeEnabled();
    expect(screen.getByTestId("recover-btn-m-progress")).toBeDisabled();
    expect(screen.getByTestId("reflect-btn-m-progress")).toBeDisabled();
  });

  it("active les bouttons en fonction du statut", () => {
    const { rerender } = render(
      <MissionCard mission={buildMission({ status: "failed" }, "m-states")} />,
    );
    expect(screen.getByTestId("run-btn-m-states")).toBeEnabled();
    expect(screen.getByTestId("recover-btn-m-states")).toBeEnabled();
    expect(screen.getByTestId("reflect-btn-m-states")).toBeEnabled();

    rerender(
      <MissionCard mission={buildMission({ status: "completed" }, "m-states")} />,
    );
    expect(screen.getByTestId("run-btn-m-states")).toBeDisabled();
    expect(screen.getByTestId("recover-btn-m-states")).toBeDisabled();
    expect(screen.getByTestId("reflect-btn-m-states")).toBeEnabled();
  });

  it("invoque les callbacks et deplie les etapes", async () => {
    const run = vi.fn();
    const recover = vi.fn();
    const reflect = vi.fn();
    render(
      <MissionCard
        mission={buildMission({ status: "failed" }, "m-callbacks")}
        onRun={run}
        onRecover={recover}
        onReflect={reflect}
      />,
    );
    fireEvent.click(screen.getByTestId("run-btn-m-callbacks"));
    fireEvent.click(screen.getByTestId("recover-btn-m-callbacks"));
    fireEvent.click(screen.getByTestId("reflect-btn-m-callbacks"));
    expect(run).toHaveBeenCalledTimes(1);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(reflect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("mission-step-s0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("expand-btn-m-callbacks"));
    expect(screen.getByTestId("mission-step-s0")).toBeInTheDocument();
    expect(screen.getByTestId("mission-step-s1")).toBeInTheDocument();
  });
});
