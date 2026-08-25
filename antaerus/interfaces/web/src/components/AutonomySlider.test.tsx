// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AutonomySlider from "@/components/AutonomySlider";

describe("AutonomySlider", () => {
  it("affiche le label et le niveau selectionne", () => {
    render(<AutonomySlider value={2} />);
    expect(screen.getByTestId("autonomy-label")).toBeInTheDocument();
    const chip = screen.getByTestId("autonomy-chip-2");
    expect(chip.className).toContain("bg-sky-500/30");
    expect(screen.getByText(/Semi-Auto/)).toBeInTheDocument();
  });

  it("appelle onChange au clic sur une puce", () => {
    const onChange = vi.fn();
    render(<AutonomySlider value={0} onChange={onChange} />);
    fireEvent.click(screen.getByTestId("autonomy-chip-5"));
    expect(onChange).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByTestId("autonomy-chip-0"));
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("met a jour la valeur via range input", () => {
    const onChange = vi.fn();
    render(<AutonomySlider value={1} onChange={onChange} />);
    const range = screen.getByTestId("autonomy-range") as HTMLInputElement;
    fireEvent.change(range, { target: { value: "4" } });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("desactive les puces et le range si disabled", () => {
    render(<AutonomySlider value={3} onChange={vi.fn()} disabled />);
    for (let i = 0; i <= 5; i += 1) {
      expect(screen.getByTestId(`autonomy-chip-${i}`)).toBeDisabled();
    }
    expect(screen.getByTestId("autonomy-range")).toBeDisabled();
  });
});
