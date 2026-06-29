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
});
