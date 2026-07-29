import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Tour } from "./Tour";
import type { TourStep } from "../lib/tour";

const steps: TourStep[] = [
  { target: null, title: "Willkommen", body: "Los geht's.", sinceVersion: 1 },
  { target: "thing", title: "Das Ding", body: "Hier ist es.", sinceVersion: 1 },
];

describe("Tour", () => {
  it("steps through with Weiter and calls onFinish at the end", () => {
    const onFinish = vi.fn();
    render(<Tour steps={steps} onFinish={onFinish} />);

    expect(screen.getByText("Willkommen")).toBeInTheDocument();
    expect(screen.getByText("Schritt 1 von 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("Das Ding")).toBeInTheDocument();

    // Last step shows "Fertig" and finishes.
    fireEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(onFinish).toHaveBeenCalled();
  });

  it("has no skip control (non-skippable by design)", () => {
    render(<Tour steps={steps} onFinish={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /überspringen|skip|abbrechen/i })).not.toBeInTheDocument();
  });

  it("highlights a target element when it exists in the DOM", () => {
    const el = document.createElement("button");
    el.setAttribute("data-tour", "thing");
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    render(<Tour steps={[steps[1]]} onFinish={vi.fn()} />);
    expect(el.scrollIntoView).toHaveBeenCalled();
    document.body.removeChild(el);
  });
});
