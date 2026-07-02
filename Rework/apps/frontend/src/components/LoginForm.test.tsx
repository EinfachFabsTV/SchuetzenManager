import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "./LoginForm";
import { api, setToken } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual<typeof import("../api/client")>("../api/client");
  return {
    ...actual,
    setToken: vi.fn(),
    api: { login: vi.fn(), registerFirstAdmin: vi.fn() },
  };
});

describe("LoginForm", () => {
  beforeEach(() => {
    vi.mocked(api.login).mockReset();
    vi.mocked(api.registerFirstAdmin).mockReset();
    vi.mocked(setToken).mockReset();
  });

  it("logs in with email/password and forwards the returned user", async () => {
    const user = { id: 1, email: "a@b.de", realName: "A" };
    vi.mocked(api.login).mockResolvedValue({ token: "tok", user });
    const onSuccess = vi.fn();

    render(<LoginForm onSuccess={onSuccess} />);
    fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: "a@b.de" } });
    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: "geheim123" } });
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith("a@b.de", "geheim123"));
    expect(setToken).toHaveBeenCalledWith("tok");
    expect(onSuccess).toHaveBeenCalledWith(user);
  });

  it("switches to registration mode and shows the name field", () => {
    render(<LoginForm onSuccess={vi.fn()} />);
    expect(screen.queryByText("Name")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Ersten Account anlegen/));

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveTextContent("Ersten Account anlegen");
  });

  it("shows the backend's error message instead of logging in on failure", async () => {
    vi.mocked(api.login).mockRejectedValue(new Error("Ungültige Zugangsdaten."));

    render(<LoginForm onSuccess={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Anmelden" }));

    await waitFor(() => expect(screen.getByText("Ungültige Zugangsdaten.")).toBeInTheDocument());
    expect(setToken).not.toHaveBeenCalled();
  });
});
