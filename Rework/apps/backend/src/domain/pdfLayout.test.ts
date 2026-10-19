import test from "node:test";
import assert from "node:assert/strict";
import { generateSeasonPdf, type PdfSeason } from "./pdf.js";
import { pdfPageTexts } from "./pdfText.testutil.js";

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
  // Kopie, weil pdfjs den Puffer übernimmt (siehe pdfText.testutil.ts).
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
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
  const pages = await pdfPageTexts(bytes);
  assert.ok(pages.length >= 2, `erwartete mehrere Seiten, waren ${pages.length}`);

  let pagesWithRows = 0;
  for (const [index, text] of pages.entries()) {
    const p = index + 1;
    // Nur Seiten prüfen, die tatsächlich Datenzeilen tragen – eine reine
    // Überschriftenseite braucht keine Spaltenköpfe.
    if (!text.includes("Max Mustermann")) continue;
    pagesWithRows++;
    assert.ok(text.includes("Schütze/inn"), `Blatt ${p} setzt die Tabelle ohne Spaltenkoepfe fort`);
  }
  assert.ok(pagesWithRows >= 2, `Tabelle hat nicht umgebrochen (${pagesWithRows} Seite(n) mit Zeilen)`);
});

test("Tabellen bekommen ein geschlossenes Gitter aus Spalten- und Zeilenlinien", async () => {
  const { pdfLines, isHorizontal, isVertical } = await import("./pdfText.testutil.js");
  const rows = 5;
  const bytes = await generateSeasonPdf(season, { personalScores: scores(rows, 3) });
  const lines = await pdfLines(bytes, 1);

  const verticals = lines.filter(isVertical);
  const horizontals = lines.filter(isHorizontal);

  // Rang, Schütze/in, Mannschaft, Gesamt, Schnitt + 3 Wochenspalten = 8
  // Spalten, also 9 senkrechte Trennlinien.
  assert.equal(verticals.length, 9, `${verticals.length} senkrechte Linien statt 9`);

  // Waagerecht: Oberkante, unter der Kopfzeile und unter jeder Datenzeile.
  // Die Linie unter der Blattüberschrift reicht bis zum rechten Seitenrand
  // und gehört nicht zur Tabelle.
  const rightEdge = Math.max(...verticals.map((l) => l.x1));
  const tableHorizontals = horizontals.filter((l) => Math.max(l.x1, l.x2) <= rightEdge + 0.01);
  assert.equal(tableHorizontals.length, rows + 2, `${tableHorizontals.length} waagerechte Tabellenlinien statt ${rows + 2}`);

  // Alle senkrechten Linien reichen über die volle Tabellenhöhe - sonst
  // stünde eine Spalte ohne durchgehenden Rahmen da.
  const top = Math.max(...verticals.map((l) => Math.max(l.y1, l.y2)));
  const bottom = Math.min(...verticals.map((l) => Math.min(l.y1, l.y2)));
  for (const v of verticals) {
    assert.equal(Math.max(v.y1, v.y2), top, `senkrechte Linie bei x=${v.x1} beginnt zu tief`);
    assert.equal(Math.min(v.y1, v.y2), bottom, `senkrechte Linie bei x=${v.x1} endet zu hoch`);
  }
});

test("kein Wert ueberschreibt den Rahmen seiner Zelle", async () => {
  const { pdfLines, isVertical } = await import("./pdfText.testutil.js");
  const bytes = await generateSeasonPdf(season, { personalScores: scores(5, 3) });
  const vLines = (await pdfLines(bytes, 1)).filter(isVertical);
  const verticals = [...new Set(vLines.map((l) => l.x1))].sort((a, b) => a - b);
  assert.ok(verticals.length >= 2, "keine Spaltenrahmen gefunden");
  // Nur was zwischen Ober- und Unterkante des Gitters steht, ist Zellinhalt;
  // Blatt- und Vereinsüberschrift stehen darüber.
  const gridTop = Math.max(...vLines.map((l) => Math.max(l.y1, l.y2)));
  const gridBottom = Math.min(...vLines.map((l) => Math.min(l.y1, l.y2)));

  let checked = 0;
  for (const item of await items(bytes, 1)) {
    if (item.y > gridTop || item.y < gridBottom) continue;
    if (item.x < verticals[0] || item.x > verticals[verticals.length - 1]) continue;
    checked++;
    const left = [...verticals].reverse().find((x) => x <= item.x + 0.01);
    const right = verticals.find((x) => x > item.x + 0.01);
    if (left === undefined || right === undefined) continue;
    // Nicht nur innerhalb bleiben, sondern auch Abstand zum Strich halten -
    // direkt am Rahmen klebender Text liest sich schlecht.
    assert.ok(
      item.x + item.width <= right - 1,
      `"${item.s}" (x ${item.x.toFixed(1)}–${(item.x + item.width).toFixed(1)}) klebt am Rahmen bei ${right} oder ragt darueber`,
    );
    assert.ok(item.x >= left + 1, `"${item.s}" (x ${item.x.toFixed(1)}) klebt am linken Rahmen bei ${left}`);
  }
  // Ohne diese Zusicherung wäre der Test auch dann grün, wenn der Filter
  // oben versehentlich jeden Wert aussortiert.
  assert.ok(checked > 20, `nur ${checked} Zellwerte geprueft - der Filter greift zu scharf`);
});
