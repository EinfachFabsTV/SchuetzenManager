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
    personalScores: [{ shooter: "Max Mustermann", team: "Beispiel 1", ageGroup: "Schützenklasse", total: 280, mean: 280 }],
  });
  // Termine, Gesamtergebnis and Einzelergebnisse each start their own page.
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
});
