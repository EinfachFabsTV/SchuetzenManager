import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StatusNotice } from "./StatusNotice";
import { shouldShow } from "../lib/statusMessage";

function mockFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body } as Response);
}

describe("shouldShow", () => {
  it("shows an active message that has not been dismissed", () => {
    expect(shouldShow({ active: true, id: "a", message: "Hallo" }, null)).toBe(true);
  });

  it("hides an inactive message", () => {
    expect(shouldShow({ active: false, id: "a", message: "Hallo" }, null)).toBe(false);
  });

  it("hides a message the user dismissed", () => {
    expect(shouldShow({ active: true, id: "a", message: "Hallo" }, "a")).toBe(false);
  });

  it("shows a NEW message even if an older one was dismissed", () => {
    // Changing the id in the repo is how an announcement reaches everyone
    // again - it must not stay hidden by an old dismissal.
    expect(shouldShow({ active: true, id: "b", message: "Neu" }, "a")).toBe(true);
  });

  it("hides an empty or missing message", () => {
    expect(shouldShow({ active: true, id: "a" }, null)).toBe(false);
    expect(shouldShow(null, null)).toBe(false);
  });
});

describe("StatusNotice", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("renders the fetched announcement", async () => {
    vi.stubGlobal("fetch", mockFetch({ active: true, id: "x", title: "Wartung", message: "Am Freitag kurz nicht erreichbar." }));
    render(<StatusNotice />);
    expect(await screen.findByText("Am Freitag kurz nicht erreichbar.")).toBeInTheDocument();
    expect(screen.getByText("Wartung")).toBeInTheDocument();
  });

  it("stays hidden while the file is inactive", async () => {
    vi.stubGlobal("fetch", mockFetch({ active: false, id: "x", message: "Nicht anzeigen" }));
    const { container } = render(<StatusNotice />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("can be dismissed and stays dismissed on the next start", async () => {
    vi.stubGlobal("fetch", mockFetch({ active: true, id: "x", message: "Hinweis" }));
    const view = render(<StatusNotice />);
    fireEvent.click(await screen.findByRole("button", { name: "Hinweis schließen" }));
    expect(screen.queryByText("Hinweis")).not.toBeInTheDocument();
    view.unmount();

    // Same id again after a restart -> must remain hidden.
    vi.stubGlobal("fetch", mockFetch({ active: true, id: "x", message: "Hinweis" }));
    const { container } = render(<StatusNotice />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("stays silent when the file cannot be fetched (offline)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { container } = render(<StatusNotice />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("stays silent on a malformed file instead of crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("kaputt"); } } as unknown as Response));
    const { container } = render(<StatusNotice />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
