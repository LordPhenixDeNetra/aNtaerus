// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MessageInput from "@/components/MessageInput";

describe("MessageInput", () => {
  it("envoie le message saisi", async () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Bonjour aNtaerus" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer/i }));

    expect(onSend).toHaveBeenCalledWith("Bonjour aNtaerus");
  });

  it("rend les contrôles voix quand ils sont fournis", () => {
    render(
      <MessageInput
        onSend={vi.fn()}
        voice={{
          mode: "idle",
          transcript: "",
          vadState: null,
          visualizerLevel: "idle",
          statusLabel: "Voix inactive",
          disabled: false,
          canBargeIn: false,
          onPrimaryAction: vi.fn(),
          onBargeIn: vi.fn(),
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Démarrer la voix/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Transcript voix/i)).toBeInTheDocument();
  });
});
