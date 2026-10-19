// Liest den sichtbaren Text eines erzeugten PDFs aus, damit Tests den
// tatsächlichen Inhalt prüfen können statt nur die Seitenzahl.
// Nur für Tests gedacht (pdfjs-dist ist eine Dev-Abhängigkeit).
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Text je Seite, Zeilen von oben nach unten, Spalten von links nach rechts. */
export async function pdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  // Kopie: pdfjs uebernimmt den Puffer und macht ihn fuer weitere Aufrufe
  // unbrauchbar - ohne sie scheitert der zweite Zugriff auf dasselbe PDF.
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
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

export type PdfLine = { x1: number; y1: number; x2: number; y2: number };

/**
 * Gezeichnete Linien einer Seite - damit Tests die Tabellenrahmen prüfen
 * können und nicht nur den Text. Jede Linie kommt als Pfad mit Anfangs- und
 * Endpunkt zurück; die Werte sind auf zwei Nachkommastellen gerundet, weil
 * pdfjs minimale Rechenungenauigkeiten durchreicht.
 */
export async function pdfLines(bytes: Uint8Array, pageNumber = 1): Promise<PdfLine[]> {
  // Kopie: pdfjs uebernimmt den Puffer und macht ihn fuer weitere Aufrufe
  // unbrauchbar - ohne sie scheitert der zweite Zugriff auf dasselbe PDF.
  const doc = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
  const ops = await (await doc.getPage(pageNumber)).getOperatorList();
  const lines: PdfLine[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] !== OPS.constructPath) continue;
    // Die letzte Komponente ist die umschließende Box des Pfades - bei einer
    // geraden Linie also genau ihre beiden Endpunkte.
    const box = (ops.argsArray[i] as unknown[])[2] as number[] | undefined;
    if (!box || box.length < 4) continue;
    const r = (n: number) => Math.round(n * 100) / 100;
    lines.push({ x1: r(box[0]), y1: r(box[1]), x2: r(box[2]), y2: r(box[3]) });
  }
  return lines;
}

export const isHorizontal = (l: PdfLine) => Math.abs(l.y1 - l.y2) < 0.01;
export const isVertical = (l: PdfLine) => Math.abs(l.x1 - l.x2) < 0.01;
