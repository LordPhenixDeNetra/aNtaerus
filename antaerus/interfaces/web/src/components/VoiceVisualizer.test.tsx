// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import VoiceVisualizer from "@/components/VoiceVisualizer";

describe("VoiceVisualizer", () => {
  it("annote le niveau visuel courant", () => {
    const { container } = render(<VoiceVisualizer level="medium" />);
    expect(container.firstChild).toHaveAttribute("data-level", "medium");
  });
});
