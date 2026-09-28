import { describe, expect, it } from "vitest";
import { filterShooters, formatShooter, type KnownShooter } from "./shooterSuggestions";

const s = (firstName: string, lastName: string): KnownShooter => ({ firstName, lastName });

const KNOWN = [
  s("Christian", "Kater"),
  s("Anna", "Müller"),
  s("Bernd", "Schmüller"),
  s("Maria", "Kater"),
  s("Jonas", "Kramer"),
];

describe("formatShooter", () => {
  it("zeigt Nachname, Vorname", () => {
    expect(formatShooter(s("Christian", "Kater"))).toBe("Kater, Christian");
  });

  it("kommt ohne Komma aus, wenn ein Teil fehlt", () => {
    expect(formatShooter(s("", "Kater"))).toBe("Kater");
    expect(formatShooter(s("Christian", ""))).toBe("Christian");
  });
});

describe("filterShooters", () => {
  it("schlaegt nichts vor, solange nichts getippt ist", () => {
    expect(filterShooters(KNOWN, "")).toEqual([]);
    expect(filterShooters(KNOWN, "   ")).toEqual([]);
  });

  it("findet ueber den Nachnamen", () => {
    expect(filterShooters(KNOWN, "kat").map(formatShooter)).toEqual(["Kater, Christian", "Kater, Maria"]);
  });

  it("findet auch ueber den Vornamen", () => {
    expect(filterShooters(KNOWN, "jon").map(formatShooter)).toEqual(["Kramer, Jonas"]);
  });

  it("stellt Treffer am Wortanfang nach vorn", () => {
    // "Müller" faengt mit der Eingabe an, "Schmüller" enthaelt sie nur.
    expect(filterShooters(KNOWN, "mül").map(formatShooter)).toEqual(["Müller, Anna", "Schmüller, Bernd"]);
  });

  it("ignoriert Gross- und Kleinschreibung", () => {
    expect(filterShooters(KNOWN, "KATER")).toHaveLength(2);
  });

  it("liefert hoechstens acht Vorschlaege", () => {
    const many = Array.from({ length: 30 }, (_, i) => s(`Vor${i}`, `Nach${i}`));
    expect(filterShooters(many, "nach")).toHaveLength(8);
  });
});
