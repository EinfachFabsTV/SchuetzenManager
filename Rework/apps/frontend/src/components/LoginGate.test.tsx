import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LoginGate } from "./LoginGate";
import { api, getToken, setToken } from "../api/client";

vi.mock("../api/client", () => ({
  api: { getAuthStatus: vi.fn(), getMe: vi.fn() },
  getToken: vi.fn(),
  setToken: vi.fn(),
}));

function renderGate() {
  return render(
    <LoginGate>
      {({ user, onLogout }) => (
        <div>
          <span data-testid="protected-content">geschützter Inhalt</span>
          <span data-testid="user-email">{user?.email ?? "kein Nutzer"}</span>
          <button onClick={onLogout}>Abmelden</button>
        </div>
      )}
    </LoginGate>,
  );
}

describe("LoginGate", () => {
  beforeEach(() => {
    vi.mocked(api.getAuthStatus).mockReset();
    vi.mocked(api.getMe).mockReset();
    vi.mocked(getToken).mockReset();
    vi.mocked(setToken).mockReset();
  });

  it("renders children directly when auth is disabled (default local/desktop mode)", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue({ enabled: false });

    renderGate();

    expect(await screen.findByTestId("protected-content")).toBeInTheDocument();
    expect(api.getMe).not.toHaveBeenCalled();
  });

  it("shows the login form when auth is enabled and no token is stored", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue({ enabled: true });
    vi.mocked(getToken).mockReturnValue(null);

    renderGate();

    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });

  it("renders children with the resolved user when a stored token is still valid", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue({ enabled: true });
    vi.mocked(getToken).mockReturnValue("valid-token");
    vi.mocked(api.getMe).mockResolvedValue({ id: 1, email: "a@b.de", realName: "A" });

    renderGate();

    expect(await screen.findByTestId("protected-content")).toBeInTheDocument();
    expect(screen.getByTestId("user-email")).toHaveTextContent("a@b.de");
  });

  it("clears a stale token and falls back to the login form when /auth/me returns nothing", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue({ enabled: true });
    vi.mocked(getToken).mockReturnValue("stale-token");
    vi.mocked(api.getMe).mockResolvedValue(null);

    renderGate();

    await waitFor(() => expect(setToken).toHaveBeenCalledWith(null));
    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeInTheDocument();
  });

  it("clears the token and falls back to the login form when /auth/me rejects (e.g. expired JWT)", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue({ enabled: true });
    vi.mocked(getToken).mockReturnValue("expired-token");
    vi.mocked(api.getMe).mockRejectedValue(new Error("401"));

    renderGate();

    await waitFor(() => expect(setToken).toHaveBeenCalledWith(null));
    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeInTheDocument();
  });

  it("treats a failing /auth/status call as auth disabled rather than blocking the app", async () => {
    vi.mocked(api.getAuthStatus).mockRejectedValue(new Error("network error"));

    renderGate();

    expect(await screen.findByTestId("protected-content")).toBeInTheDocument();
  });

  it("logout clears the token, resets the user, and shows the login form again", async () => {
    vi.mocked(api.getAuthStatus).mockResolvedValue({ enabled: true });
    vi.mocked(getToken).mockReturnValue("valid-token");
    vi.mocked(api.getMe).mockResolvedValue({ id: 1, email: "a@b.de", realName: "A" });

    renderGate();
    await screen.findByTestId("protected-content");

    screen.getByRole("button", { name: "Abmelden" }).click();

    expect(setToken).toHaveBeenCalledWith(null);
    expect(await screen.findByRole("button", { name: "Anmelden" })).toBeInTheDocument();
  });
});
