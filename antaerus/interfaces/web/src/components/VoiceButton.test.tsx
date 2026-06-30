// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VoiceButton from "@/components/VoiceButton";

describe("VoiceButton", () => {
  it("affiche le bouton de démarrage en mode idle", () => {
    render(
      <VoiceButton
        mode="idle"
        statusLabel="Voix inactive"
        onPrimaryAction={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Démarrer la voix/i }),
    ).toBeInTheDocument();
  });

  it("affiche le bouton d'interruption en mode speaking", () => {
    const onBargeIn = vi.fn();
    render(
      <VoiceButton
        mode="speaking"
        statusLabel="Réponse en cours"
        canBargeIn
        onPrimaryAction={vi.fn()}
        onBargeIn={onBargeIn}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Interrompre la réponse vocale/i }),
    );
    expect(onBargeIn).toHaveBeenCalled();
  });
});
