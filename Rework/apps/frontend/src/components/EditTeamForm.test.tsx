import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditTeamForm } from "./EditTeamForm";
import { api } from "../api/client";
import type { Team } from "../types";

vi.mock("../api/client", () => ({ api: { updateTeam: vi.fn() } }));

const team: Team = {
  id: 1,
  name: "Meppen 1",
  trainingDay: "Montag",
  trainingTime: "20:00",
  location: "Schützenhaus",
  contact: "Max Mustermann",
  phone: "0591 123456",
  seasonId: 1,
};

describe("EditTeamForm", () => {
  beforeEach(() => {
    vi.mocked(api.updateTeam).mockReset();
  });

  it("pre-fills every field from the given team, with empty string for null values", () => {
    render(<EditTeamForm team={{ ...team, contact: null, phone: null }} onSaved={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByDisplayValue("Meppen 1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Montag")).toBeInTheDocument();
    expect(screen.getByDisplayValue("20:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Schützenhaus")).toBeInTheDocument();
  });

  it("submits the edited fields and forwards the saved team", async () => {
    const updated = { ...team, name: "Meppen 1 (SG)" };
    vi.mocked(api.updateTeam).mockResolvedValue(updated);
    const onSaved = vi.fn();

    render(<EditTeamForm team={team} onSaved={onSaved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByDisplayValue("Meppen 1"), { target: { value: "Meppen 1 (SG)" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(api.updateTeam).toHaveBeenCalledWith(1, {
        name: "Meppen 1 (SG)",
        trainingDay: "Montag",
        trainingTime: "20:00",
        location: "Schützenhaus",
        contact: "Max Mustermann",
        phone: "0591 123456",
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(updated);
  });

  it("shows the backend's error message on a rejected save (e.g. duplicate name)", async () => {
    vi.mocked(api.updateTeam).mockRejectedValue(new Error("Der Mannschaftsname ist bereits belegt."));

    render(<EditTeamForm team={team} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Der Mannschaftsname ist bereits belegt.")).toBeInTheDocument();
  });

  it("calls onCancel without saving", () => {
    const onCancel = vi.fn();
    render(<EditTeamForm team={team} onSaved={vi.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(onCancel).toHaveBeenCalled();
    expect(api.updateTeam).not.toHaveBeenCalled();
  });
});
