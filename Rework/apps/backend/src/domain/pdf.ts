import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { TableRow } from "./table.js";
import type { PersonalScoreRow } from "./personalScores.js";

// Functional port of pdf/PDFFactory.java: same three reports (Termine,
// Gesamtergebnis, Einzelergebnisse), rebuilt with pdf-lib's simpler text/line
// primitives instead of hand-computed PDFBox column offsets. Column widths
// are still measured from the actual content (like the legacy
// calculateXBorders* methods) so long team/shooter names don't clip.
// Simplification vs. the legacy PDF: no per-competition-week match detail
// pages, and the Einzelergebnisse table shows season totals/mean only, not
// the legacy's per-week score matrix.

const PAGE_MARGIN = 50;
const ROW_HEIGHT = 18;
const FONT_SIZE = 10;

export type PdfSeason = {
  year: number;
  label: string;
  contactPerson: string | null;
  contactMail: string | null;
};

export type PdfTeam = {
  name: string;
  trainingDay: string | null;
  trainingTime: string | null;
  location: string | null;
  contact: string | null;
  phone: string | null;
};

export type PdfMatch = {
  week: number;
  homeTeam: string;
  guestTeam: string;
};

export type PdfSections = {
  dates?: { teams: PdfTeam[]; matchesByWeek: PdfMatch[][] };
  resultTable?: TableRow[];
  personalScores?: PersonalScoreRow[];
};

class PageWriter {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page!: PDFPage;
  y = 0;
  readonly width: number;
  readonly height: number;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.width = 595.28; // A4 portrait, points
    this.height = 841.89;
  }

  newPage() {
    this.page = this.doc.addPage([this.width, this.height]);
    this.y = this.height - PAGE_MARGIN;
  }

  ensureSpace(needed: number) {
    if (this.y - needed < PAGE_MARGIN) this.newPage();
  }

  text(value: string, x: number, y: number, opts?: { bold?: boolean; size?: number }) {
    this.page.drawText(value, {
      x,
      y,
      size: opts?.size ?? FONT_SIZE,
      font: opts?.bold ? this.bold : this.font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  }
}

function columnWidth(font: PDFFont, header: string, values: string[], size = FONT_SIZE, padding = 16): number {
  let max = font.widthOfTextAtSize(header, size);
  for (const v of values) {
    const w = font.widthOfTextAtSize(v, size);
    if (w > max) max = w;
  }
  return max + padding;
}

function drawHeading(w: PageWriter, season: PdfSeason, title: string) {
  w.text(title, PAGE_MARGIN, w.y, { size: 20, bold: true });
  w.y -= 26;
  w.text(`Saison ${season.year}`, PAGE_MARGIN, w.y, { size: 12 });
  const labelWidth = w.font.widthOfTextAtSize(season.label, 12);
  w.text(season.label, w.width - PAGE_MARGIN - labelWidth, w.y, { size: 12 });
  w.y -= 24;
}

function drawTable(
  w: PageWriter,
  columns: { header: string; width: number; align?: "left" | "right"; get: (row: any) => string }[],
  rows: any[],
) {
  const tableLeft = PAGE_MARGIN;
  const drawHeader = () => {
    let x = tableLeft;
    for (const col of columns) {
      w.text(col.header, x, w.y, { bold: true });
      x += col.width;
    }
    w.line(tableLeft, w.y - 4, x, w.y - 4);
    w.y -= ROW_HEIGHT;
  };

  drawHeader();
  for (const row of rows) {
    w.ensureSpace(ROW_HEIGHT);
    let x = tableLeft;
    for (const col of columns) {
      const value = col.get(row);
      const textX = col.align === "right" ? x + col.width - 8 - w.font.widthOfTextAtSize(value, FONT_SIZE) : x;
      w.text(value, textX, w.y);
      x += col.width;
    }
    w.y -= ROW_HEIGHT;
  }
  w.y -= 10;
}

function drawResultTable(w: PageWriter, season: PdfSeason, rows: TableRow[]) {
  w.newPage();
  drawHeading(w, season, "Gesamtergebnis");

  const teamNames = rows.map((r) => r.team);
  const teamWidth = columnWidth(w.bold, "Mannschaft", teamNames, FONT_SIZE, 24);
  const numWidth = 55;

  drawTable(
    w,
    [
      { header: "Mannschaft", width: teamWidth, get: (r: TableRow) => r.team },
      { header: "Gewonnen", width: numWidth, align: "right", get: (r: TableRow) => String(r.win) },
      { header: "Verloren", width: numWidth, align: "right", get: (r: TableRow) => String(r.loose) },
      { header: "Unentschieden", width: numWidth + 20, align: "right", get: (r: TableRow) => String(r.tied) },
      { header: "Ringe", width: numWidth, align: "right", get: (r: TableRow) => String(r.rings) },
      { header: "Punkte", width: numWidth, align: "right", get: (r: TableRow) => String(r.points) },
    ],
    rows,
  );
}

function drawPersonalScores(w: PageWriter, season: PdfSeason, ageGroup: string, rows: PersonalScoreRow[]) {
  if (rows.length === 0) return;
  w.newPage();
  drawHeading(w, season, `Einzelergebnisse ${ageGroup}`);

  const shooterWidth = columnWidth(w.bold, "Schütze/inn", rows.map((r) => r.shooter));
  const teamWidth = columnWidth(w.bold, "Mannschaft", rows.map((r) => r.team));

  drawTable(
    w,
    [
      { header: "Schütze/inn", width: shooterWidth, get: (r: PersonalScoreRow) => r.shooter },
      { header: "Mannschaft", width: teamWidth, get: (r: PersonalScoreRow) => r.team },
      { header: "Gesamt", width: 70, align: "right", get: (r: PersonalScoreRow) => String(r.total) },
      { header: "Schnitt", width: 70, align: "right", get: (r: PersonalScoreRow) => String(r.mean) },
    ],
    rows,
  );
}

function drawDates(w: PageWriter, season: PdfSeason, teams: PdfTeam[], matchesByWeek: PdfMatch[][]) {
  w.newPage();
  drawHeading(w, season, "Rundenwettkämpfe");

  for (const week of matchesByWeek) {
    if (week.length === 0) continue;
    w.ensureSpace(ROW_HEIGHT * (week.length + 1));
    w.text(`Wettkampfwoche ${week[0].week}`, PAGE_MARGIN, w.y, { bold: true });
    w.y -= ROW_HEIGHT;
    for (const match of week) {
      w.text(`${match.homeTeam} vs. ${match.guestTeam}`, PAGE_MARGIN + 10, w.y);
      w.y -= ROW_HEIGHT;
    }
    w.y -= 6;
  }

  w.y -= 10;
  w.ensureSpace(ROW_HEIGHT * (teams.length + 2));
  w.text("Mannschaften", PAGE_MARGIN, w.y, { size: 14, bold: true });
  w.y -= 22;

  const nameWidth = columnWidth(w.bold, "Mannschaft", teams.map((t) => t.name));
  const dayWidth = columnWidth(w.bold, "Trainingstag", teams.map((t) => t.trainingDay ?? "-"));
  const timeWidth = columnWidth(w.bold, "Uhrzeit", teams.map((t) => t.trainingTime ?? "-"));
  const locationWidth = columnWidth(w.bold, "Ort", teams.map((t) => t.location ?? "-"));
  const contactWidth = columnWidth(w.bold, "Ansprechpartner", teams.map((t) => t.contact ?? "-"));

  drawTable(
    w,
    [
      { header: "Mannschaft", width: nameWidth, get: (t: PdfTeam) => t.name },
      { header: "Trainingstag", width: dayWidth, get: (t: PdfTeam) => t.trainingDay ?? "-" },
      { header: "Uhrzeit", width: timeWidth, get: (t: PdfTeam) => t.trainingTime ?? "-" },
      { header: "Ort", width: locationWidth, get: (t: PdfTeam) => t.location ?? "-" },
      { header: "Ansprechpartner", width: contactWidth, get: (t: PdfTeam) => t.contact ?? "-" },
    ],
    teams,
  );
}

export async function generateSeasonPdf(season: PdfSeason, sections: PdfSections): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PageWriter(doc, font, bold);

  if (sections.dates) drawDates(w, season, sections.dates.teams, sections.dates.matchesByWeek);
  if (sections.resultTable) drawResultTable(w, season, sections.resultTable);
  if (sections.personalScores) {
    for (const ageGroup of new Set(sections.personalScores.map((s) => s.ageGroup))) {
      drawPersonalScores(w, season, ageGroup, sections.personalScores.filter((s) => s.ageGroup === ageGroup));
    }
  }

  return doc.save();
}
