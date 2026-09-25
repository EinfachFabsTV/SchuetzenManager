import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { generateSeasonPdf, type PdfMatch, type PdfSeason, type PdfTeam } from "./pdf.js";

const season: PdfSeason = {
  year: 2026,
  label: "LG - Auflage A",
  contactPerson: null,
  contactMail: null,
  headerLine1: "Beispiel-Schützenkreis",
  headerLine2: "www.beispiel.de",
};

function teams(count: number): PdfTeam[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Beispiel ${i + 1}`,
    trainingDay: "Donnerstag",
    trainingTime: "19:00",
    location: `Musterstr. ${i + 1}`,
    contact: "Max Mustermann",
    phone: "0123/4567891",
  }));
}

/** `weeks` matchdays with `perWeek` pairings each. */
function schedule(weeks: number, perWeek = 3): PdfMatch[][] {
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: perWeek }, (_, m) => ({
      week: w + 1,
      homeTeam: `Beispiel ${m * 2 + 1}`,
      guestTeam: `Beispiel ${m * 2 + 2}`,
      date: "2026-01-12",
      dateGuest: "2026-01-18",
    })),
  );
}

async function pageCount(sections: Parameters<typeof generateSeasonPdf>[1]): Promise<number> {
  const bytes = await generateSeasonPdf(season, sections);
  return (await PDFDocument.load(bytes)).getPageCount();
}

test("a comfortably sized season fits on a single page", async () => {
  const pages = await pageCount({ dates: { teams: teams(6), matchesByWeek: schedule(8), maxWeek: 8 } });
  assert.equal(pages, 1);
});

// The sizes below were measured against the real layout: without the
// shrink-to-fit each of them pushed the Mannschaften table onto a second page,
// even though it was only slightly too tall. That is exactly what must not
// happen any more.
for (const [weeks, teamCount] of [
  [8, 10],
  [9, 7],
  [9, 10],
  [10, 7],
] as const) {
  test(`a section overflowing slightly stays on the page (${weeks} Wochen, ${teamCount} Mannschaften)`, async () => {
    const pages = await pageCount({ dates: { teams: teams(teamCount), matchesByWeek: schedule(weeks), maxWeek: weeks } });
    assert.equal(pages, 1, "Bereich hätte durch Verkleinern auf der Seite bleiben müssen");
  });
}

test("content that genuinely cannot fit still breaks to a new page", async () => {
  // Far beyond what shrinking may compensate - the guard must give up rather
  // than scale the text into illegibility.
  const pages = await pageCount({ dates: { teams: teams(10), matchesByWeek: schedule(11), maxWeek: 11 } });
  assert.ok(pages >= 2, `erwartete mehrere Seiten, waren ${pages}`);
});

test("every requested section is rendered", async () => {
  const bytes = await generateSeasonPdf(season, {
    dates: { teams: teams(4), matchesByWeek: schedule(6, 2), maxWeek: 6 },
    resultTable: [{ teamId: 1, team: "Beispiel 1", win: 1, loose: 0, tied: 0, rings: 800, points: 2 }],
    personalScores: [{ shooter: "Max Mustermann", team: "Beispiel 1", ageGroup: "Schützenklasse", total: 280, mean: 280, byWeek: [280] }],
  });
  // Termine, Gesamtergebnis and Einzelergebnisse each start their own page.
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
});

// --- Inhaltliche Pruefungen gegen die Vereinsvorlage -------------------------
// Diese Tests lesen den tatsaechlichen PDF-Text aus, nicht nur die Seitenzahl.

const tableRows = [
  { teamId: 1, team: "Beispiel 1", win: 13, loose: 1, tied: 0, rings: 13189.7, points: 26 },
  { teamId: 2, team: "Beispiel 2", win: 12, loose: 2, tied: 0, rings: 13080, points: 24 },
];

test("schreibt Zahlen deutsch mit Dezimalkomma und Tausenderpunkt", async () => {
  const { pdfText } = await import("./pdfText.testutil.js");
  const bytes = await generateSeasonPdf(season, { resultTable: tableRows });
  const text = await pdfText(bytes);

  assert.ok(text.includes("13.189,7"), `Tausenderpunkt/Dezimalkomma fehlen in: ${text.slice(0, 400)}`);
  // Ganzzahlige Ringe bekommen keine erfundene Nachkommastelle.
  assert.ok(text.includes("13.080"), "ganzzahliger Wert nicht deutsch formatiert");
  // Und keine rohe JavaScript-Zahl mehr.
  assert.ok(!text.includes("13189.7"), "englische Schreibweise noch vorhanden");
});

test("zeigt in den Einzelergebnissen Rang, Schnitt und Wochenspalten", async () => {
  const { pdfText } = await import("./pdfText.testutil.js");
  const scores = [
    { shooter: "Max Mustermann", team: "Beispiel 1", ageGroup: "Schützenklasse", total: 931.2, mean: 310.4, byWeek: [310.4, null, 620.8] },
  ];
  const bytes = await generateSeasonPdf(season, { personalScores: scores });
  const text = await pdfText(bytes);

  assert.ok(text.includes("Schnitt"), "Schnitt-Spalte fehlt");
  assert.ok(text.includes("310,4"), "Schnitt nicht deutsch formatiert");
  // Wochenspalten 1..3 als Kopfzeile, plus der Rang vor dem Namen.
  assert.ok(/(^|\s)1\s+2\s+3(\s|$)/m.test(text), `Wochenspalten fehlen in: ${text.slice(0, 400)}`);
  assert.ok(/1\s+Max Mustermann/.test(text), "Rang fehlt vor dem Namen");
  // Woche ohne Einsatz bleibt leer statt 0.
  assert.ok(!/Max Mustermann[^\n]*\s0(\s|$)/.test(text), "leere Woche wurde als 0 gedruckt");
});

test("stellt die Begegnungen der Woche mit beiden Ergebnissen dar", async () => {
  const { pdfText } = await import("./pdfText.testutil.js");
  const bytes = await generateSeasonPdf(season, {
    weekReport: {
      week: 14,
      date: "2026-03-30",
      dateGuest: "2026-04-05",
      results: [
        { homeTeam: "Beispiel 1", homeScore: 936.7, guestTeam: "Beispiel 2", guestScore: 934.3 },
        { homeTeam: "Beispiel 3", homeScore: 925, guestTeam: "Beispiel 4", guestScore: 934 },
      ],
      table: tableRows,
    },
  });
  const text = await pdfText(bytes);

  assert.ok(text.includes("Wettkampfwoche 14"), "Wochenueberschrift fehlt");
  assert.ok(text.includes("30.03.2026 - 05.04.2026"), "Zeitraum fehlt");
  assert.ok(text.includes("Heimmannschaft") && text.includes("Gastmannschaft"), "Spaltenkoepfe fehlen");
  assert.ok(/Beispiel 1\s+936,7\s+Beispiel 2\s+934,3/.test(text), `Begegnung mit Ergebnissen fehlt in: ${text.slice(0, 600)}`);
  assert.ok(text.includes("Tabelle nach der 14. Wettkampfwoche"), "Tabelle nach der Woche fehlt");
});
