// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import VoiceTranscript from "@/components/VoiceTranscript";

describe("VoiceTranscript", () => {
  it("affiche le transcript courant quand il existe", () => {
    render(
      <VoiceTranscript
        mode="listening"
        transcript="Bonjour en direct"
        vadState="speaking"
        statusLabel="Écoute active"
      />,
    );

    expect(screen.getByText("Bonjour en direct")).toBeInTheDocument();
  });

  it("affiche un placeholder quand le transcript est vide", () => {
    render(
      <VoiceTranscript
        mode="idle"
        transcript=""
        vadState={null}
        statusLabel="Voix inactive"
      />,
    );

    expect(
      screen.getByText(/La transcription temps réel apparaîtra ici/i),
    ).toBeInTheDocument();
  });
});
