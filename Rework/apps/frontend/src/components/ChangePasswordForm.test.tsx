import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { api } from "../api/client";

vi.mock("../api/client", () => ({ api: { changePassword: vi.fn() } }));

function fillAndSubmit(current: string, next: string, confirm: string) {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  fireEvent.change(passwordInputs[0], { target: { value: current } });
  fireEvent.change(passwordInputs[1], { target: { value: next } });
  fireEvent.change(passwordInputs[2], { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.mocked(api.changePassword).mockReset();
  });

  it("blocks submission client-side when the confirmation does not match, without calling the API", async () => {
    render(<ChangePasswordForm onClose={vi.fn()} />);

    fillAndSubmit("altesPasswort", "neuesPasswort1", "neuesPasswort2");

    expect(await screen.findByText("Die neuen Passwörter stimmen nicht überein.")).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("submits matching passwords and shows a success state", async () => {
    vi.mocked(api.changePassword).mockResolvedValue({ ok: true });
    render(<ChangePasswordForm onClose={vi.fn()} />);

    fillAndSubmit("altesPasswort", "neuesPasswort1", "neuesPasswort1");

    await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith("altesPasswort", "neuesPasswort1"));
    expect(await screen.findByText("Passwort wurde geändert.")).toBeInTheDocument();
  });

  it("surfaces a backend rejection (e.g. wrong current password) as an error message", async () => {
    vi.mocked(api.changePassword).mockRejectedValue(new Error("Aktuelles Passwort ist falsch."));
    render(<ChangePasswordForm onClose={vi.fn()} />);

    fillAndSubmit("falsch", "neuesPasswort1", "neuesPasswort1");

    expect(await screen.findByText("Aktuelles Passwort ist falsch.")).toBeInTheDocument();
  });

  it("clicking the backdrop closes the dialog, clicking inside the form does not", () => {
    const onClose = vi.fn();
    render(<ChangePasswordForm onClose={onClose} />);

    // DOM shape: outer backdrop <div onClick=onClose> > <form onClick=stopPropagation> > <h3>.
    // closest("div") from the heading skips the non-div <form> and lands on the backdrop.
    const backdrop = screen.getByText("Passwort ändern").closest("div")!;

    fireEvent.click(screen.getByRole("heading"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });
});
