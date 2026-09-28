import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { ShooterNameInput } from "./ShooterNameInput";
import type { KnownShooter } from "../lib/shooterSuggestions";

const KNOWN: KnownShooter[] = [
  { firstName: "Christian", lastName: "Kater" },
  { firstName: "Maria", lastName: "Kater" },
  { firstName: "Anna", lastName: "Müller" },
];

/** Wie im Formular: das Feld ist kontrolliert, die Auswahl meldet nach oben. */
function Harness({ onPick }: { onPick: (s: KnownShooter) => void }) {
  const [value, setValue] = useState("");
  return (
    <ShooterNameInput
      label="Nachname"
      style={{}}
      known={KNOWN}
      value={value}
      onChange={setValue}
      onPick={(s) => {
        setValue(s.lastName);
        onPick(s);
      }}
    />
  );
}

function type(text: string) {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: text } });
}

describe("ShooterNameInput", () => {
  it("zeigt erst nach einer Eingabe Vorschlaege, im Format Nachname, Vorname", () => {
    render(<Harness onPick={() => {}} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    type("kat");
    expect(screen.getByRole("option", { name: "Kater, Christian" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Kater, Maria" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Müller, Anna" })).not.toBeInTheDocument();
  });

  it("uebernimmt einen Vorschlag per Klick", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    type("kat");
    fireEvent.click(screen.getByRole("option", { name: "Kater, Maria" }));

    expect(onPick).toHaveBeenCalledWith({ firstName: "Maria", lastName: "Kater" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("uebernimmt den markierten Vorschlag mit Tab", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    type("kat");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Tab" });

    expect(onPick).toHaveBeenCalledWith({ firstName: "Christian", lastName: "Kater" });
  });

  it("waehlt mit den Pfeiltasten und uebernimmt mit Enter", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    type("kat");
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onPick).toHaveBeenCalledWith({ firstName: "Maria", lastName: "Kater" });
  });

  it("schliesst die Liste mit Escape, ohne etwas zu uebernehmen", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    type("kat");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("laesst freies Tippen zu, auch ohne passenden Vorschlag", () => {
    render(<Harness onPick={() => {}} />);
    type("Neuling");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect((screen.getByRole("combobox") as HTMLInputElement).value).toBe("Neuling");
  });
});
