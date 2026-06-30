// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MessageBubble from "@/components/MessageBubble";
import { createChatMessage } from "@/lib/chat";

describe("MessageBubble", () => {
  it("affiche un message assistant en streaming", () => {
    render(
      <MessageBubble
        message={createChatMessage(
          "assistant",
          "Bonjour",
          "sse-dev",
          "streaming",
        )}
      />,
    );

    expect(screen.getByText("Bonjour")).toBeInTheDocument();
    expect(screen.getByText(/En cours/i)).toBeInTheDocument();
  });

  it("rend le markdown basique", () => {
    render(
      <MessageBubble
        message={createChatMessage(
          "assistant",
          "Je suis **aNtaerus**",
          "ws",
          "complete",
        )}
      />,
    );

    const strong = screen.getByText("aNtaerus");
    expect(strong.tagName).toBe("STRONG");
  });
});
