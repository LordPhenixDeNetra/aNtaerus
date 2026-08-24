// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import MissionStepRow from "@/components/MissionStep";
import type { MissionStep } from "@/lib/api";

afterEach(() => {
  cleanup();
});

function buildStep(status: MissionStep["status"]): MissionStep {
  return {
    id: `step-${status}`,
    index: 0,
    title: `Etape ${status}`,
    description: "Description etape",
    status,
    toolName: "filesystem",
    toolArgs: { path: "/tmp" },
    result: status === "completed"
      ? {
          stepId: `step-${status}`,
          status,
          durationMs: 120,
          toolName: "filesystem",
          outputSummary: "ok",
        }
      : undefined,
  };
}

describe("MissionStep", () => {
  it("rend 4 variantes visuelles de statut", () => {
    const statuses: MissionStep["status"][] = [
      "pending",
      "running",
      "completed",
      "failed",
    ];
    render(
      <>
        {statuses.map((s) => (
          <MissionStepRow key={s} step={buildStep(s)} />
        ))}
      </>,
    );
    for (const s of statuses) {
      const step = screen.getByTestId(`mission-step-step-${s}`);
      expect(within(step).getByTestId(`step-status-pill-step-${s}`)).toHaveTextContent(s);
    }
    expect(screen.getByTestId("icon-pending")).toBeInTheDocument();
    expect(screen.getByTestId("icon-running")).toBeInTheDocument();
    expect(screen.getByTestId("icon-completed")).toBeInTheDocument();
    expect(screen.getByTestId("icon-failed")).toBeInTheDocument();
  });

  it("deploie les details de l'etape au clic", () => {
    render(<MissionStepRow step={buildStep("completed")} />);
    const stepRow = screen.getByTestId("mission-step-step-completed");
    const ChevronRightIcon = within(stepRow).getByTestId("chevron-right");
    expect(ChevronRightIcon).toBeInTheDocument();
    expect(screen.queryByTestId("step-result-step-completed")).not.toBeInTheDocument();
    fireEvent.click(ChevronRightIcon);
    expect(within(stepRow).getByTestId("chevron-down")).toBeInTheDocument();
    expect(screen.getByTestId("step-result-step-completed")).toBeInTheDocument();
    expect(screen.getByText("duree : 120 ms")).toBeInTheDocument();
  });
});
