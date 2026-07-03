import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SettingsPage } from "./SettingsPage";
import { api } from "../api/client";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));
vi.mock("../api/client", () => ({
  api: { getUsers: vi.fn(), createUser: vi.fn(), deleteUser: vi.fn(), resetUserPassword: vi.fn() },
}));

function markAsTauri() {
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });
}

function unmarkTauri() {
  delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

const user = { id: 1, email: "admin@example.com", realName: "Admin" };

describe("SettingsPage", () => {
  beforeEach(() => {
    invokeMock.mockReset();
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
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("blocks mismatched confirmation without calling invoke", async () => {
      render(<SettingsPage user={null} />);

      fillAndSubmit("altesPasswort", "neuesPasswort1", "andereseins");

      expect(await screen.findByText("Die neuen Passwörter stimmen nicht überein.")).toBeInTheDocument();
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("calls vault_change_password with the entered values and shows success", async () => {
      invokeMock.mockResolvedValue(undefined);
      render(<SettingsPage user={null} />);

      fillAndSubmit("altesPasswort", "neuesPasswort1", "neuesPasswort1");

      await waitFor(() =>
        expect(invokeMock).toHaveBeenCalledWith("vault_change_password", {
          currentSecret: "altesPasswort",
          newPassword: "neuesPasswort1",
        }),
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
      const nameInput = Array.from(inputs).find((i) => i.type === "text")!;
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
