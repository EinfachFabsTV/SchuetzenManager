// Liest den sichtbaren Text eines erzeugten PDFs aus, damit Tests den
// tatsächlichen Inhalt prüfen können statt nur die Seitenzahl.
// Nur für Tests gedacht (pdfjs-dist ist eine Dev-Abhängigkeit).
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Text je Seite, Zeilen von oben nach unten, Spalten von links nach rechts. */
export async function pdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  const doc = await getDocument({ data: bytes, useSystemFonts: true }).promise;
  const pages: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines = new Map<number, { x: number; s: string }[]>();

    for (const item of content.items as { str: string; transform: number[] }[]) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push({ x: Math.round(item.transform[4]), s: item.str });
    }

    pages.push(
      [...lines.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.s).join(" "))
        .join("\n"),
    );
  }
  return pages;
}

/** Gesamter Text aller Seiten. */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  return (await pdfPageTexts(bytes)).join("\n");
}
