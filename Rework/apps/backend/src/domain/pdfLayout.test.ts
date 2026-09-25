import test from "node:test";
import assert from "node:assert/strict";
import { generateSeasonPdf, type PdfSeason } from "./pdf.js";

// Prüft die geometrische Anordnung, nicht nur den Text: ein Wert darf seine
// Spalte nicht verlassen. Ein reiner Textvergleich würde eine Überlappung
// nicht bemerken – im ersten Entwurf ragte "300,3" aus der schmalen
// Wochenspalte in die Schnitt-Spalte hinein.

const season: PdfSeason = {
  year: 2026,
  label: "LG - Auflage A",
  contactPerson: null,
  contactMail: null,
  headerLine1: "Beispiel-Schützenkreis",
  headerLine2: "www.beispiel.de",
};

type Item = { x: number; width: number; s: string; y: number };

async function items(bytes: Uint8Array, pageNumber: number): Promise<Item[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  return (content.items as { str: string; width: number; transform: number[] }[])
    .filter((i) => i.str.trim())
    .map((i) => ({ x: i.transform[4], width: i.width, s: i.str, y: Math.round(i.transform[5]) }));
}

function scores(shooters: number, weeks: number) {
  return Array.from({ length: shooters }, (_, s) => ({
    shooter: `Max Mustermann ${s + 1}`,
    team: "Beispiel 1",
    ageGroup: "Schützenklasse",
    total: 300.3 * weeks,
    mean: 300.3,
    byWeek: Array.from({ length: weeks }, () => 300.3),
  }));
}

test("Werte bleiben innerhalb der Seitenränder, auch bei voller Saison", async () => {
  const bytes = await generateSeasonPdf(season, { personalScores: scores(12, 14) });
  const all = await items(bytes, 1);
  const rightEdge = 595.28 - 50 + 1; // A4-Breite minus Rand, 1pt Toleranz

  const overflow = all.filter((i) => i.x + i.width > rightEdge);
  assert.equal(overflow.length, 0, `ragt über den Rand: ${overflow.map((o) => `${o.s}@${Math.round(o.x)}`).join(", ")}`);
});

test("Wochenwerte überlappen einander nicht", async () => {
  const bytes = await generateSeasonPdf(season, { personalScores: scores(6, 14) });
  const all = await items(bytes, 1);

  // Datenzeilen = Zeilen, die einen Schützennamen enthalten.
  const rowYs = [...new Set(all.filter((i) => i.s.startsWith("Max Mustermann")).map((i) => i.y))];
  assert.ok(rowYs.length > 0, "keine Datenzeilen gefunden");

  for (const y of rowYs) {
    const row = all.filter((i) => i.y === y).sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const prev = row[i - 1];
      const cur = row[i];
      assert.ok(
        prev.x + prev.width <= cur.x + 0.5,
        `"${prev.s}" (endet ${Math.round(prev.x + prev.width)}) überlappt "${cur.s}" (beginnt ${Math.round(cur.x)})`,
      );
    }
  }
});

test("Kopfzeile und erste Datenzeile bleiben spaltenweise ausgerichtet", async () => {
  const bytes = await generateSeasonPdf(season, { personalScores: scores(3, 5) });
  const all = await items(bytes, 1);

  const headerY = all.find((i) => i.s === "Schütze/inn")?.y;
  assert.ok(headerY !== undefined, "Kopfzeile nicht gefunden");
  const headers = all.filter((i) => i.y === headerY).sort((a, b) => a.x - b.x);

  // Die Wochenköpfe 1..5 stehen in aufsteigender Reihenfolge nebeneinander.
  const weekHeaders = headers.filter((h) => /^\d+$/.test(h.s)).map((h) => Number(h.s));
  assert.deepEqual(weekHeaders, [1, 2, 3, 4, 5]);
});

test("wiederholt die Spaltenkoepfe nach einem Seitenumbruch", async () => {
  // Genug Schuetzen, dass die Tabelle sicher umbricht.
  const bytes = await generateSeasonPdf(season, { personalScores: scores(70, 4) });
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  assert.ok(doc.numPages >= 2, `erwartete mehrere Seiten, waren ${doc.numPages}`);

  let pagesWithRows = 0;
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const text = (await page.getTextContent()).items.map((i: { str: string }) => i.str).join(" ");
    // Nur Seiten prüfen, die tatsächlich Datenzeilen tragen – eine reine
    // Überschriftenseite braucht keine Spaltenköpfe.
    if (!text.includes("Max Mustermann")) continue;
    pagesWithRows++;
    assert.ok(text.includes("Schütze/inn"), `Blatt ${p} setzt die Tabelle ohne Spaltenkoepfe fort`);
  }
  assert.ok(pagesWithRows >= 2, `Tabelle hat nicht umgebrochen (${pagesWithRows} Seite(n) mit Zeilen)`);
});
