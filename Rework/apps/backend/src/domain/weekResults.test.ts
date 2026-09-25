import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeekResults } from "./weekResults.js";

const teamNames = new Map([
  [1, "Beispiel 1"],
  [2, "Beispiel 2"],
  [3, "Beispiel 3"],
  [4, "Beispiel 4"],
]);

function shoot(teamSide: "HOME" | "GUEST", result: number, additional = false) {
  return { teamSide, additional, result };
}

function match(week: number, homeTeamId: number, guestTeamId: number, home: number[], guest: number[]) {
  return {
    week,
    homeTeamId,
    guestTeamId,
    shoots: [...home.map((r) => shoot("HOME", r)), ...guest.map((r) => shoot("GUEST", r))],
  };
}

test("liefert nur die Begegnungen der gewählten Woche", () => {
  const rows = computeWeekResults(
    [
      match(1, 1, 2, [310, 310, 310, 300], [300, 300, 300, 290]),
      match(2, 3, 4, [320, 320, 320, 310], [310, 310, 310, 300]),
    ],
    teamNames,
    2,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].homeTeam, "Beispiel 3");
  assert.equal(rows[0].guestTeam, "Beispiel 4");
});

test("zählt nur die besten drei regulären Schützen je Seite", () => {
  const rows = computeWeekResults([match(1, 1, 2, [310, 305, 300, 295], [290, 285, 280, 275])], teamNames, 1);
  // Der jeweils schwächste der vier regulären Schützen fällt heraus.
  assert.equal(rows[0].homeScore, 310 + 305 + 300);
  assert.equal(rows[0].guestScore, 290 + 285 + 280);
});

test("ignoriert Zusatzschützen beim Mannschaftsergebnis", () => {
  const withExtra = {
    week: 1,
    homeTeamId: 1,
    guestTeamId: 2,
    shoots: [
      shoot("HOME", 300),
      shoot("HOME", 300),
      shoot("HOME", 300),
      shoot("HOME", 290),
      // Ein starker Zusatzschütze darf das Ergebnis nicht anheben.
      shoot("HOME", 400, true),
      shoot("GUEST", 290),
      shoot("GUEST", 290),
      shoot("GUEST", 290),
    ],
  };
  const rows = computeWeekResults([withExtra], teamNames, 1);
  assert.equal(rows[0].homeScore, 900);
});

test("rundet die Mannschaftsergebnisse auf eine Nachkommastelle", () => {
  const rows = computeWeekResults([match(1, 1, 2, [300.1, 300.1, 300.1], [300.3, 300.3, 300.3])], teamNames, 1);
  for (const value of [rows[0].homeScore, rows[0].guestScore]) {
    assert.ok((String(value).split(".")[1] ?? "").length <= 1, `driftet: ${value}`);
  }
  assert.equal(rows[0].homeScore, 900.3);

  // Positivkontrolle: ungerundet driftet genau diese Summe.
  const naive = 300.1 + 300.1 + 300.1;
  assert.ok((String(naive).split(".")[1] ?? "").length > 1, "Testdaten driften nicht – Kontrolle wertlos");
});

test("zeigt eine noch nicht erfasste Begegnung mit 0 statt sie wegzulassen", () => {
  const rows = computeWeekResults([match(1, 1, 2, [], [])], teamNames, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].homeScore, 0);
  assert.equal(rows[0].guestScore, 0);
});
