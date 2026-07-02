import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateSeasonForm } from "./CreateSeasonForm";
import { api } from "../api/client";

vi.mock("../api/client", () => ({ api: { createSeason: vi.fn() } }));

function nameInputs() {
  return Array.from(document.querySelectorAll('input[placeholder="Mannschaftsname"]')) as HTMLInputElement[];
}

describe("CreateSeasonForm", () => {
  beforeEach(() => {
    vi.mocked(api.createSeason).mockReset();
  });

  it("starts with two empty team rows", () => {
    render(<CreateSeasonForm onCreated={vi.fn()} onCancel={vi.fn()} />);
    expect(nameInputs()).toHaveLength(2);
  });

  it("adds and removes team rows", () => {
    render(<CreateSeasonForm onCreated={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByText("+ Mannschaft"));
    expect(nameInputs()).toHaveLength(3);

    fireEvent.click(screen.getAllByText("Entfernen")[0]);
    expect(nameInputs()).toHaveLength(2);
  });

  it("blocks submission with fewer than 2 named teams, without calling the API", async () => {
    render(<CreateSeasonForm onCreated={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(nameInputs()[0], { target: { value: "Meppen 1" } });
    // second row stays blank
    fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));

    expect(await screen.findByText("Bitte mindestens 2 Mannschaften mit Namen angeben.")).toBeInTheDocument();
    expect(api.createSeason).not.toHaveBeenCalled();
  });

  it("filters out blank team rows before submitting", async () => {
    vi.mocked(api.createSeason).mockResolvedValue({ id: 7 } as never);
    const onCreated = vi.fn();

    render(<CreateSeasonForm onCreated={onCreated} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText("+ Mannschaft"));
    const inputs = nameInputs();
    fireEvent.change(inputs[0], { target: { value: "Meppen 1" } });
    fireEvent.change(inputs[1], { target: { value: "  " } });
    fireEvent.change(inputs[2], { target: { value: "Geeste 1" } });

    fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));

    await waitFor(() =>
      expect(api.createSeason).toHaveBeenCalledWith(
        expect.objectContaining({ teams: [{ name: "Meppen 1" }, { name: "Geeste 1" }] }),
      ),
    );
    expect(onCreated).toHaveBeenCalledWith(7);
  });

  it("shows the backend's error message on failure", async () => {
    vi.mocked(api.createSeason).mockRejectedValue(new Error("Eine Saison braucht mindestens 2 Mannschaften."));

    render(<CreateSeasonForm onCreated={vi.fn()} onCancel={vi.fn()} />);
    const inputs = nameInputs();
    fireEvent.change(inputs[0], { target: { value: "Meppen 1" } });
    fireEvent.change(inputs[1], { target: { value: "Geeste 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));

    expect(await screen.findByText("Eine Saison braucht mindestens 2 Mannschaften.")).toBeInTheDocument();
  });
});
