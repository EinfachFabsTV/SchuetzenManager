import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTable } from "./table.js";

const teams = [
  { id: 1, name: "Meppen 1" },
  { id: 2, name: "Geeste 1" },
  { id: 3, name: "Dalum 6" },
];

function shoot(teamSide: "HOME" | "GUEST", result: number, additional = false) {
  return { teamSide, additional, result };
}

test("home win awards 2 points to home, 0 to guest, and sums rings", () => {
  const table = computeTable(teams, [
    {
      homeTeamId: 1,
      guestTeamId: 2,
      shoots: [shoot("HOME", 382), shoot("HOME", 370), shoot("HOME", 360), shoot("GUEST", 355), shoot("GUEST", 340), shoot("GUEST", 300)],
    },
  ]);
  const home = table.find((r) => r.teamId === 1)!;
  const guest = table.find((r) => r.teamId === 2)!;
  assert.equal(home.win, 1);
  assert.equal(home.loose, 0);
  assert.equal(home.points, 2);
  assert.equal(home.rings, 382 + 370 + 360);
  assert.equal(guest.win, 0);
  assert.equal(guest.loose, 1);
  assert.equal(guest.points, 0);
  assert.equal(guest.rings, 355 + 340 + 300);
});

test("a tie awards 1 point to each side", () => {
  const table = computeTable(teams, [
    {
      homeTeamId: 1,
      guestTeamId: 2,
      shoots: [shoot("HOME", 300), shoot("GUEST", 300)],
    },
  ]);
  const home = table.find((r) => r.teamId === 1)!;
  const guest = table.find((r) => r.teamId === 2)!;
  assert.equal(home.tied, 1);
  assert.equal(guest.tied, 1);
  assert.equal(home.points, 1);
  assert.equal(guest.points, 1);
});

test("additional (substitute) shoots never count toward the match score", () => {
  const table = computeTable(teams, [
    {
      homeTeamId: 1,
      guestTeamId: 2,
      shoots: [shoot("HOME", 300), shoot("GUEST", 100), shoot("GUEST", 9999, true)],
    },
  ]);
  const guest = table.find((r) => r.teamId === 2)!;
  assert.equal(guest.rings, 100);
});

test("a match with no results yet does not affect the table", () => {
  const table = computeTable(teams, [{ homeTeamId: 1, guestTeamId: 2, shoots: [] }]);
  assert.ok(table.every((r) => r.win === 0 && r.loose === 0 && r.tied === 0 && r.points === 0 && r.rings === 0));
});

test("sorts by points desc, then rings desc, then team name asc", () => {
  const table = computeTable(teams, [
    { homeTeamId: 1, guestTeamId: 2, shoots: [shoot("HOME", 300), shoot("GUEST", 100)] },
    { homeTeamId: 3, guestTeamId: 2, shoots: [shoot("HOME", 300), shoot("GUEST", 100)] },
  ]);
  // Meppen 1 and Dalum 6 both have 2 points and 300 rings -> tie-break by name.
  assert.deepEqual(
    table.map((r) => r.team),
    ["Dalum 6", "Meppen 1", "Geeste 1"],
  );
});

test("rundet aufsummierte Ringe, damit keine Fließkomma-Artefakte entstehen", () => {
  // Zehntelwerte summieren sich in Fließkomma sonst zu 932.4000000000001 auf –
  // das stand so im PDF und hat dort sogar die Spalten verschoben.
  const drifting = [300.1, 300.1, 300.1];
  const table = computeTable(teams, [
    {
      homeTeamId: 1,
      guestTeamId: 2,
      shoots: [
        shoot("HOME", drifting[0]),
        shoot("HOME", drifting[1]),
        shoot("HOME", drifting[2]),
        shoot("GUEST", 300.3),
        shoot("GUEST", 300.3),
        shoot("GUEST", 300.3),
      ],
    },
  ]);
  const home = table.find((r) => r.teamId === 1)!;
  const guest = table.find((r) => r.teamId === 2)!;

  // Unabhängig gemessen: höchstens eine Nachkommastelle, keine Artefaktziffern.
  for (const value of [home.rings, guest.rings]) {
    const decimals = (String(value).split(".")[1] ?? "").length;
    assert.ok(decimals <= 1, `zu viele Nachkommastellen: ${value}`);
  }
  // Positivkontrolle: die naive Summe hätte hier tatsächlich gedriftet.
  const naive = drifting.reduce((a, b) => a + b, 0);
  assert.ok((String(naive).split(".")[1] ?? "").length > 1, "Testdaten driften nicht – Kontrolle wertlos");
  assert.equal(home.rings, 900.3);
});

test("rundet auch über mehrere Wettkampfwochen hinweg", () => {
  const match = (home: number, guest: number) => ({
    homeTeamId: 1,
    guestTeamId: 2,
    shoots: [
      shoot("HOME", home),
      shoot("HOME", home),
      shoot("HOME", home),
      shoot("GUEST", guest),
      shoot("GUEST", guest),
      shoot("GUEST", guest),
    ],
  });
  // Werte so gewählt, dass die Match-für-Match-Summe ohne Rundung driftet
  // (siehe Positivkontrolle unten).
  const table = computeTable(teams, [match(300.1, 250), match(300.3, 250), match(300.1, 250)]);
  const home = table.find((r) => r.teamId === 1)!;
  assert.ok((String(home.rings).split(".")[1] ?? "").length <= 1, `driftet: ${home.rings}`);
  assert.equal(home.rings, 2701.5);

  // Positivkontrolle: dieselbe Reihenfolge ohne Zwischenrundung driftet.
  const scores = [300.1 + 300.1 + 300.1, 300.3 + 300.3 + 300.3, 300.1 + 300.1 + 300.1];
  let naive = 0;
  for (const s of scores) naive += s;
  assert.ok((String(naive).split(".")[1] ?? "").length > 1, "Testdaten driften nicht – Kontrolle wertlos");
});
