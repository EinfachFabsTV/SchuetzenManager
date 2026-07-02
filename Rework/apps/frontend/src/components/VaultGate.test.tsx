import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VaultGate } from "./VaultGate";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));

function markAsTauri() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
}

function unmarkTauri() {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function renderGate() {
  return render(
    <VaultGate>
      <span data-testid="protected-content">geschützter Inhalt</span>
    </VaultGate>,
  );
}

describe("VaultGate", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    unmarkTauri();
  });

  it("renders children immediately outside Tauri (web/central-hosting mode)", () => {
    renderGate();
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("shows the setup screen when vault_status resolves no_vault", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("no_vault");

    renderGate();

    expect(await screen.findByRole("heading", { name: "Passwort festlegen" })).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("shows the locked screen when vault_status resolves locked", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("locked");

    renderGate();

    expect(await screen.findByRole("heading", { name: "Entsperren" })).toBeInTheDocument();
  });

  it("setup: rejects a too-short password without calling vault_setup", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("no_vault");

    renderGate();
    await screen.findByRole("heading", { name: "Passwort festlegen" });

    fireEvent.change(document.querySelectorAll('input[type="password"]')[0], { target: { value: "short" } });
    fireEvent.change(document.querySelectorAll('input[type="password"]')[1], { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Passwort festlegen" }));

    expect(await screen.findByText("Das Passwort muss mindestens 8 Zeichen lang sein.")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledTimes(1); // only vault_status, not vault_setup
  });

  it("setup: rejects mismatched password confirmation", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("no_vault");

    renderGate();
    await screen.findByRole("heading", { name: "Passwort festlegen" });

    fireEvent.change(document.querySelectorAll('input[type="password"]')[0], { target: { value: "geheim123" } });
    fireEvent.change(document.querySelectorAll('input[type="password"]')[1], { target: { value: "anderesgeheim" } });
    fireEvent.click(screen.getByRole("button", { name: "Passwort festlegen" }));

    expect(await screen.findByText("Die Passwörter stimmen nicht überein.")).toBeInTheDocument();
  });

  it("setup: shows the recovery code and gates continuing behind the confirmation checkbox", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("no_vault");
    invokeMock.mockResolvedValueOnce("ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-4567-89AB");

    renderGate();
    await screen.findByRole("heading", { name: "Passwort festlegen" });

    fireEvent.change(document.querySelectorAll('input[type="password"]')[0], { target: { value: "geheim123" } });
    fireEvent.change(document.querySelectorAll('input[type="password"]')[1], { target: { value: "geheim123" } });
    fireEvent.click(screen.getByRole("button", { name: "Passwort festlegen" }));

    expect(await screen.findByText("ABCD-EFGH-JKMN-PQRS-TVWX-YZ23-4567-89AB")).toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith("vault_setup", { password: "geheim123" });

    const continueButton = screen.getByRole("button", { name: "Weiter" });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(continueButton).not.toBeDisabled();

    fireEvent.click(continueButton);
    expect(await screen.findByTestId("protected-content")).toBeInTheDocument();
  });

  it("unlock: shows the backend's error and does not render children on a wrong secret", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("locked");
    invokeMock.mockRejectedValueOnce("Falsches Passwort oder falscher Wiederherstellungscode.");

    renderGate();
    await screen.findByRole("heading", { name: "Entsperren" });

    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "falsch" } });
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    expect(await screen.findByText("Falsches Passwort oder falscher Wiederherstellungscode.")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("unlock: renders children after a correct secret", async () => {
    markAsTauri();
    invokeMock.mockResolvedValueOnce("locked");
    invokeMock.mockResolvedValueOnce(undefined);

    renderGate();
    await screen.findByRole("heading", { name: "Entsperren" });

    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "richtig123" } });
    fireEvent.click(screen.getByRole("button", { name: "Entsperren" }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("vault_unlock", { secret: "richtig123" }));
    expect(await screen.findByTestId("protected-content")).toBeInTheDocument();
  });
});
