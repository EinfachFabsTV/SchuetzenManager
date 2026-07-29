import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";
import { api } from "../api/client";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
vi.mock("../api/client", () => ({
  api: { getUsers: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(), resetUserPassword: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn() },
}));

function markAsTauri() {
  // Route the real @tauri core's invoke to the same mock too, so it doesn't
  // matter whether a dynamic import resolves to the mocked module or the real
  // one - both end up calling invokeMock.
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: { invoke: (...args: unknown[]) => invokeMock(...args) },
    configurable: true,
  });
}

function unmarkTauri() {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

const user = { id: 1, email: "admin@example.com", realName: "Admin" };

describe("SettingsPage", () => {
  beforeEach(() => {
    // Default so the restore section's vault_list_backups mount call resolves
    // cleanly; individual tests override for vault_change_password etc.
    invokeMock.mockReset().mockResolvedValue([]);
    vi.mocked(api.getSettings).mockReset().mockResolvedValue({ headerLine1: null, headerLine2: null, hasLogo: false });
    vi.mocked(api.updateSettings).mockReset().mockResolvedValue({ headerLine1: null, headerLine2: null, hasLogo: false });
    vi.mocked(api.getUsers).mockReset().mockResolvedValue([]);
    vi.mocked(api.createUser).mockReset();
    vi.mocked(api.deleteUser).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.resetUserPassword).mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    unmarkTauri();
  });

  it("shows no sections outside Tauri without a logged-in user", () => {
    render(<SettingsPage user={null} />);

    expect(screen.getByRole("heading", { name: "Einstellungen" })).toBeInTheDocument();
    expect(screen.queryByText("Tresor-Passwort ändern")).not.toBeInTheDocument();
    expect(screen.queryByText("Mein Account")).not.toBeInTheDocument();
    expect(screen.queryByText("Nutzerverwaltung")).not.toBeInTheDocument();
  });

  it("shows the vault section only inside Tauri", () => {
    markAsTauri();
    render(<SettingsPage user={null} />);

    expect(screen.getByText("Tresor-Passwort ändern")).toBeInTheDocument();
  });

  describe("vault restore section", () => {
    beforeEach(() => markAsTauri());

    it("lists found backups and restores the chosen one with the entered secret", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "vault_list_backups") return Promise.resolve([{ name: "reset-backup-2026-07-05-120000", label: "05.07.2026 12:00" }]);
        return Promise.resolve(undefined);
      });
      render(<SettingsPage user={null} />);

      expect(await screen.findByText("05.07.2026 12:00")).toBeInTheDocument();
      const secret = screen.getByLabelText(/Passwort oder Wiederherstellungscode dieser Sicherung/);
      fireEvent.change(secret, { target: { value: "MEIN-CODE" } });
      fireEvent.click(screen.getByRole("button", { name: "Wiederherstellen" }));

      await waitFor(() =>
        expect(
          invokeMock.mock.calls.some(
            (c) => c[0] === "vault_restore" && (c[1] as { backupName?: string })?.backupName === "reset-backup-2026-07-05-120000" && (c[1] as { secret?: string })?.secret === "MEIN-CODE",
          ),
        ).toBe(true),
      );
      expect(await screen.findByText(/Die alten Daten sind jetzt aktiv/)).toBeInTheDocument();
    });

    it("shows an empty-state message when there are no backups", async () => {
      invokeMock.mockResolvedValue([]);
      render(<SettingsPage user={null} />);
      expect(await screen.findByText("Keine gesicherten Datenbestände gefunden.")).toBeInTheDocument();
    });

    it("surfaces a rejected restore (wrong secret) as an error", async () => {
      invokeMock.mockImplementation((cmd: string) => {
        if (cmd === "vault_list_backups") return Promise.resolve([{ name: "reset-backup-2026-07-05-120000", label: "05.07.2026 12:00" }]);
        return Promise.reject("Falsches Passwort oder falscher Wiederherstellungscode.");
      });
      render(<SettingsPage user={null} />);

      const secret = await screen.findByLabelText(/Passwort oder Wiederherstellungscode dieser Sicherung/);
      fireEvent.change(secret, { target: { value: "falsch" } });
      fireEvent.click(screen.getByRole("button", { name: "Wiederherstellen" }));

      expect(await screen.findByText("Falsches Passwort oder falscher Wiederherstellungscode.")).toBeInTheDocument();
    });
  });

  it("shows account/user-management sections only when a user is logged in", () => {
    render(<SettingsPage user={user} />);

    expect(screen.getByText("Mein Account")).toBeInTheDocument();
    expect(screen.getByText("Nutzerverwaltung")).toBeInTheDocument();
  });

  describe("vault password section", () => {
    beforeEach(() => markAsTauri());

    function fillAndSubmit(current: string, next: string, confirm: string) {
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      fireEvent.change(passwordInputs[0], { target: { value: current } });
      fireEvent.change(passwordInputs[1], { target: { value: next } });
      fireEvent.change(passwordInputs[2], { target: { value: confirm } });
      fireEvent.click(screen.getByRole("button", { name: "Passwort ändern" }));
    }

    it("blocks a too-short new password without calling invoke", async () => {
      render(<SettingsPage user={null} />);

      fillAndSubmit("altesPasswort", "kurz", "kurz");

      expect(await screen.findByText("Das Passwort muss mindestens 8 Zeichen lang sein.")).toBeInTheDocument();
      expect(invokeMock).not.toHaveBeenCalledWith("vault_change_password", expect.anything());
    });

    it("blocks mismatched confirmation without calling invoke", async () => {
      render(<SettingsPage user={null} />);

      fillAndSubmit("altesPasswort", "neuesPasswort1", "andereseins");

      expect(await screen.findByText("Die neuen Passwörter stimmen nicht überein.")).toBeInTheDocument();
      expect(invokeMock).not.toHaveBeenCalledWith("vault_change_password", expect.anything());
    });

    it("calls vault_change_password with the entered values and shows success", async () => {
      invokeMock.mockResolvedValue(undefined);
      render(<SettingsPage user={null} />);

      fillAndSubmit("altesPasswort", "neuesPasswort1", "neuesPasswort1");

      await waitFor(() =>
        expect(
          invokeMock.mock.calls.some(
            (c) => c[0] === "vault_change_password" && (c[1] as { currentSecret?: string })?.currentSecret === "altesPasswort" && (c[1] as { newPassword?: string })?.newPassword === "neuesPasswort1",
          ),
        ).toBe(true),
      );
      expect(await screen.findByText("Tresor-Passwort wurde geändert.")).toBeInTheDocument();
    });

    it("surfaces a rejected invoke as an error message", async () => {
      invokeMock.mockRejectedValue("Falsches Passwort oder falscher Wiederherstellungscode.");
      render(<SettingsPage user={null} />);

      fillAndSubmit("falsch", "neuesPasswort1", "neuesPasswort1");

      expect(await screen.findByText("Falsches Passwort oder falscher Wiederherstellungscode.")).toBeInTheDocument();
    });
  });

  describe("user management section", () => {
    it("lists users returned from getUsers", async () => {
      vi.mocked(api.getUsers).mockResolvedValue([user, { id: 2, email: "b@b.de", realName: "B" }]);

      render(<SettingsPage user={user} />);

      expect(await screen.findByText("Admin")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();
    });

    it("shows an empty-state message when there are no users yet", async () => {
      vi.mocked(api.getUsers).mockResolvedValue([]);

      render(<SettingsPage user={user} />);

      expect(await screen.findByText("Noch keine Nutzer.")).toBeInTheDocument();
    });

    it("creates a user and shows the confirmation message", async () => {
      const created = { id: 3, email: "new@example.com", realName: "Neu" };
      vi.mocked(api.createUser).mockResolvedValue(created);

      render(<SettingsPage user={user} />);
      await screen.findByText("Noch keine Nutzer.");

      fireEvent.click(screen.getByRole("button", { name: "+ Nutzer hinzufügen" }));
      const inputs = document.querySelectorAll("input");
      const emailInput = Array.from(inputs).find((i) => i.type === "email")!;
      // Scope to the add-user form so the PDF-header text inputs elsewhere
      // on the settings page aren't mistaken for the name field.
      const nameInput = emailInput.form!.querySelector('input:not([type="email"])') as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "new@example.com" } });
      fireEvent.change(nameInput, { target: { value: "Neu" } });
      fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      await waitFor(() => expect(api.createUser).toHaveBeenCalledWith("new@example.com", "Neu"));
      expect(await screen.findByText("Ein Zugangslink wurde per E-Mail versendet.")).toBeInTheDocument();
      expect(screen.getByText("Neu")).toBeInTheDocument();
    });

    it("shows the backend's error on a rejected create (e.g. duplicate email)", async () => {
      vi.mocked(api.createUser).mockRejectedValue(new Error("Diese E-Mail-Adresse ist bereits registriert."));

      render(<SettingsPage user={user} />);
      await screen.findByText("Noch keine Nutzer.");

      fireEvent.click(screen.getByRole("button", { name: "+ Nutzer hinzufügen" }));
      const inputs = document.querySelectorAll("input");
      const emailInput = Array.from(inputs).find((i) => i.type === "email")!;
      fireEvent.change(emailInput, { target: { value: "dup@example.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));

      expect(await screen.findByText("Diese E-Mail-Adresse ist bereits registriert.")).toBeInTheDocument();
    });

    it("resets a user's password and shows a confirmation", async () => {
      vi.mocked(api.getUsers).mockResolvedValue([user]);

      render(<SettingsPage user={user} />);
      await screen.findByText("Admin");

      fireEvent.click(screen.getByRole("button", { name: "Passwort zurücksetzen" }));

      await waitFor(() => expect(api.resetUserPassword).toHaveBeenCalledWith(1));
      expect(await screen.findByText(/per E-Mail versendet/)).toBeInTheDocument();
    });

    it("deletes a user after confirmation and removes them from the list", async () => {
      vi.mocked(api.getUsers).mockResolvedValue([user, { id: 2, email: "b@b.de", realName: "B" }]);
      vi.spyOn(window, "confirm").mockReturnValue(true);

      render(<SettingsPage user={user} />);
      await screen.findByText("Admin");

      fireEvent.click(screen.getAllByRole("button", { name: "Löschen" })[0]);

      await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith(1));
      await waitFor(() => expect(screen.queryByText("Admin")).not.toBeInTheDocument());
      expect(screen.getByText("B")).toBeInTheDocument();
    });

    it("does not delete when the confirmation is cancelled", async () => {
      vi.mocked(api.getUsers).mockResolvedValue([user]);
      vi.spyOn(window, "confirm").mockReturnValue(false);

      render(<SettingsPage user={user} />);
      await screen.findByText("Admin");

      fireEvent.click(screen.getByRole("button", { name: "Löschen" }));

      expect(api.deleteUser).not.toHaveBeenCalled();
    });
  });
});
