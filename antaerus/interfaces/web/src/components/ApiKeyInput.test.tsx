// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ApiKeyInput from "@/components/ApiKeyInput";

describe("ApiKeyInput", () => {
  it("permet d'afficher la clé", () => {
    const onChange = vi.fn();
    render(
      <ApiKeyInput
        id="openai"
        label="OpenAI"
        value="sk-demo"
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("OpenAI")).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: /Afficher la clé/i }));

    expect(screen.getByLabelText("OpenAI")).toHaveAttribute("type", "text");
  });
});
