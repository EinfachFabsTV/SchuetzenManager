import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VaultResetPanel } from "./VaultResetPanel";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));

function markAsTauri() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
}

function unmarkTauri() {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "Zugang verloren?" }));
}

describe("VaultResetPanel", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    unmarkTauri();
  });

  it("renders nothing outside Tauri (web/central-hosting mode)", () => {
    const { container } = render(<VaultResetPanel onReset={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps the reset button disabled until the confirmation word is typed", () => {
    markAsTauri();
    render(<VaultResetPanel onReset={() => {}} />);
    openPanel();

    const resetButton = screen.getByRole("button", { name: "Zurücksetzen" });
    expect(resetButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Bestätigung"), { target: { value: "irgendwas" } });
    expect(resetButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Bestätigung"), { target: { value: "Bestätigen" } });
    expect(resetButton).toBeEnabled();
  });

  it("calls vault_reset and shows where the old data was kept", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("C:\\Daten\\reset-backup-2026-07-05-120000");
    render(<VaultResetPanel onReset={() => {}} />);
    openPanel();

    fireEvent.change(screen.getByLabelText("Bestätigung"), { target: { value: "Bestätigen" } });
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("vault_reset"));
    expect(await screen.findByText(/reset-backup-2026-07-05-120000/)).toBeInTheDocument();
  });

  it("hands control back to the caller once the user continues", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("/daten/reset-backup-2026-07-05-120000");
    const onReset = vi.fn();
    render(<VaultResetPanel onReset={onReset} />);
    openPanel();

    fireEvent.change(screen.getByLabelText("Bestätigung"), { target: { value: "Bestätigen" } });
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));

    fireEvent.click(await screen.findByRole("button", { name: "Weiter zur Ersteinrichtung" }));
    expect(onReset).toHaveBeenCalled();
  });

  it("surfaces a failed reset instead of pretending it worked", async () => {
    markAsTauri();
    invokeMock.mockRejectedValueOnce("Konnte Sicherungsordner nicht anlegen: Zugriff verweigert");
    render(<VaultResetPanel onReset={() => {}} />);
    openPanel();

    fireEvent.change(screen.getByLabelText("Bestätigung"), { target: { value: "Bestätigen" } });
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));

    expect(await screen.findByText(/Zugriff verweigert/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Weiter zur Ersteinrichtung" })).not.toBeInTheDocument();
  });
});

describe("VaultResetPanel confirmation wording", () => {
  afterEach(() => {
    unmarkTauri();
  });

  function typeAndCheck(value: string) {
    markAsTauri();
    const view = render(<VaultResetPanel onReset={() => {}} />);
    openPanel();
    fireEvent.change(screen.getByLabelText("Bestätigung"), { target: { value } });
    const enabled = !screen.getByRole("button", { name: "Zurücksetzen" }).hasAttribute("disabled");
    view.unmount();
    unmarkTauri();
    return enabled;
  }

  it("accepts the word regardless of case, padding, or the umlaut", () => {
    // The umlaut-free spelling matters: this is the one way back for a
    // locked-out user and must not hinge on a keyboard layout.
    for (const value of ["Bestätigen", "bestätigen", "BESTÄTIGEN", "  Bestätigen  ", "bestaetigen", "Bestaetigen"]) {
      expect(typeAndCheck(value), value).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["", "best", "bestätige", "confirm", "zurücksetzen"]) {
      expect(typeAndCheck(value), value).toBe(false);
    }
  });
});
