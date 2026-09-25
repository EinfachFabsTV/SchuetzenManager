import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { TableRow } from "./table.js";
import type { PersonalScoreRow } from "./personalScores.js";
import type { WeekResultRow } from "./weekResults.js";
import { formatDe, formatDe1 } from "./numbers.js";

// Functional port of pdf/PDFFactory.java: same reports (Termine,
// Gesamtergebnis, Einzelergebnisse, Wochenbericht), rebuilt with pdf-lib's
// simpler text/line primitives instead of hand-computed PDFBox column
// offsets. Column widths are still measured from the actual content (like the
// legacy calculateXBorders* methods) so long team/shooter names don't clip.
// Numbers follow the printed club template: German notation via
// domain/numbers.ts, never a raw JavaScript float.

const PAGE_MARGIN = 50;
const ROW_HEIGHT = 18;
const FONT_SIZE = 10;

export type PdfSeason = {
  year: number;
  label: string;
  contactPerson: string | null;
  contactMail: string | null;
  // Resolved PDF header (season override or global default): two text lines
  // + optional logo bytes. See routes/seasons.ts's PDF handler.
  headerLine1?: string | null;
  headerLine2?: string | null;
  logo?: Uint8Array | null;
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
  // ISO "YYYY-MM-DD" or null; rendered as DD.MM.YYYY. `date` is the home
  // leg date, `dateGuest` the optional second date shown below it.
  date?: string | null;
  dateGuest?: string | null;
};

// ISO "YYYY-MM-DD" -> "DD.MM.YYYY". Returns "" for empty/malformed input so
// the week header simply omits the date rather than printing garbage.
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

export type PdfSections = {
  dates?: { teams: PdfTeam[]; matchesByWeek: PdfMatch[][]; maxWeek: number };
  resultTable?: TableRow[];
  personalScores?: PersonalScoreRow[];
  /**
   * Wochenbericht wie Blatt 4 der Vorlage: die Begegnungen einer
   * Wettkampfwoche mit beiden Ergebnissen, darunter der Tabellenstand nach
   * dieser Woche.
   */
  weekReport?: {
    week: number;
    date?: string | null;
    dateGuest?: string | null;
    results: WeekResultRow[];
    table: TableRow[];
  };
};

// Hinrunde = weeks 1..ceil(maxWeek/2), Rückrunde the rest (mirrors the
// frontend lib/rounds.ts and the round-robin generator's return-leg offset).
function roundOfWeek(week: number, maxWeek: number): "hin" | "rueck" {
  return week <= Math.ceil(maxWeek / 2) ? "hin" : "rueck";
}

// How far a section may be shrunk to avoid being torn across a page break.
// 0.72 still prints legibly at the 10pt base size; below that the gain in
// tidiness isn't worth the loss in readability, so the section moves to the
// next page instead.
const MIN_SECTION_SCALE = 0.72;

class PageWriter {
  doc: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
  page!: PDFPage;
  y = 0;
  /** Multiplies every font size and row height while a section is drawn. */
  scale = 1;
  readonly width: number;
  readonly height: number;

  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.width = 595.28; // A4 portrait, points
    this.height = 841.89;
  }

  get fontSize(): number {
    return FONT_SIZE * this.scale;
  }

  get rowHeight(): number {
    return ROW_HEIGHT * this.scale;
  }

  /** Vertical space left on the current page. */
  get available(): number {
    return this.y - PAGE_MARGIN;
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
      size: (opts?.size ?? FONT_SIZE) * this.scale,
      font: opts?.bold ? this.bold : this.font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
  }
}

/**
 * Draws a block that should not be split across pages.
 *
 * If it fits as-is, nothing changes. If it would overflow by a little, the
 * whole block is drawn slightly smaller so it still fits on the current page -
 * that is the point: a section must not wander to the next page just because
 * of one or two lines. Only when even the smallest allowed size wouldn't help
 * does the block start on a fresh page.
 *
 * `neededHeight` must be measured at scale 1; the helper scales it itself.
 */
function drawSection(w: PageWriter, neededHeight: number, render: () => void, neededWidth?: number) {
  // Überbreite lässt sich – anders als Überlänge – nicht durch einen
  // Seitenumbruch lösen. Sie muss immer weggeskaliert werden, sonst ragen
  // Spalten über den Rand oder Werte überlappen ihre Nachbarspalte.
  const usableWidth = w.width - 2 * PAGE_MARGIN;
  const widthScale = neededWidth && neededWidth > usableWidth ? usableWidth / neededWidth : 1;

  const fits = neededHeight <= w.available;
  const heightScale = w.available / neededHeight;

  const draw = (scale: number) => {
    w.scale = scale;
    try {
      render();
    } finally {
      w.scale = 1;
    }
  };

  if (!fits && heightScale >= MIN_SECTION_SCALE) {
    draw(Math.min(heightScale, widthScale));
    return;
  }

  if (!fits) w.newPage();
  draw(widthScale);
}

function columnWidth(font: PDFFont, header: string, values: string[], size = FONT_SIZE, padding = 16): number {
  let max = font.widthOfTextAtSize(header, size);
  for (const v of values) {
    const w = font.widthOfTextAtSize(v, size);
    if (w > max) max = w;
  }
  return max + padding;
}

/**
 * Vereinskopf oben links: Logo, darüber/daneben Vereinsname und Website.
 * Steht in der Vorlage auf JEDEM Blatt, nicht nur auf dem ersten.
 * `logoImage` ist vom Aufrufer vorab eingebettet (das asynchrone Einbetten
 * kann in diesem synchronen Schreiber nicht passieren).
 */
function drawClubHeader(w: PageWriter, season: PdfSeason, logoImage: PDFImage | null) {
  const top = w.y;
  let textLeft = PAGE_MARGIN;
  if (logoImage) {
    const size = 48;
    const scaled = logoImage.scaleToFit(size, size);
    w.page.drawImage(logoImage, { x: PAGE_MARGIN, y: top - size, width: scaled.width, height: scaled.height });
    textLeft = PAGE_MARGIN + size + 12;
  }
  if (season.headerLine1) w.text(season.headerLine1, textLeft, top - 14, { size: 14, bold: true });
  if (season.headerLine2) w.text(season.headerLine2, textLeft, top - 30, { size: 9 });
  w.y = top - (logoImage ? 48 : 36) - 24;
}

/**
 * Überschrift eines Folgeblatts: Vereinskopf, Titel, darunter links die
 * Saison und rechts die Klassenbezeichnung. `subtitle` steht – wie der
 * Zeitraum im Wochenbericht der Vorlage – direkt unter dem Titel.
 */
function drawHeading(w: PageWriter, season: PdfSeason, title: string, logoImage: PDFImage | null, subtitle?: string) {
  drawClubHeader(w, season, logoImage);
  w.text(title, PAGE_MARGIN, w.y, { size: 20, bold: true });
  w.y -= subtitle ? 20 : 26;
  if (subtitle) {
    w.text(subtitle, PAGE_MARGIN, w.y, { size: 11 });
    w.y -= 18;
  }
  w.text(`Saison ${season.year}`, PAGE_MARGIN, w.y, { size: 12 });
  const labelWidth = w.font.widthOfTextAtSize(season.label, 12);
  w.text(season.label, w.width - PAGE_MARGIN - labelWidth, w.y, { size: 12 });
  w.y -= 16;
  w.line(PAGE_MARGIN, w.y, w.width - PAGE_MARGIN, w.y);
  w.y -= 18;
}

// Kopf des Spielplanblatts: Vereinskopf, Titel "Rundenwettkämpfe", darunter
// Saison links und Klassenbezeichnung rechts.
function drawScheduleHeader(w: PageWriter, season: PdfSeason, logoImage: PDFImage | null) {
  drawClubHeader(w, season, logoImage);

  w.text("Rundenwettkämpfe", PAGE_MARGIN, w.y, { size: 20, bold: true });
  w.y -= 22;
  // Season on the left below the title, the class label right-aligned on the
  // same line - as in the printed original.
  w.text(`Saison ${season.year}`, PAGE_MARGIN, w.y, { size: 12 });
  const labelWidth = w.font.widthOfTextAtSize(season.label, 12);
  w.text(season.label, w.width - PAGE_MARGIN - labelWidth, w.y, { size: 12 });
  w.y -= 16;
  w.line(PAGE_MARGIN, w.y, w.width - PAGE_MARGIN, w.y);
  w.y -= 18;
}

function drawTable<Row>(
  w: PageWriter,
  columns: { header: string; width: number; align?: "left" | "right"; get: (row: Row, index: number) => string }[],
  rows: Row[],
) {
  const tableLeft = PAGE_MARGIN;
  // Column widths were measured at full size; shrink them with the section so
  // the table keeps its proportions instead of drifting apart.
  const colWidth = (raw: number) => raw * w.scale;
  const drawHeader = () => {
    let x = tableLeft;
    for (const col of columns) {
      w.text(col.header, x, w.y, { bold: true });
      x += colWidth(col.width);
    }
    w.line(tableLeft, w.y - 4, x, w.y - 4);
    w.y -= w.rowHeight;
  };

  drawHeader();
  for (const [index, row] of rows.entries()) {
    const yBefore = w.y;
    w.ensureSpace(w.rowHeight);
    // Nach einem Seitenumbruch springt y wieder nach oben. Dann die
    // Spaltenköpfe wiederholen - eine fortgesetzte Tabelle ohne Kopfzeile
    // ist nicht lesbar.
    if (w.y > yBefore) drawHeader();
    let x = tableLeft;
    for (const col of columns) {
      const value = col.get(row, index);
      const textX = col.align === "right" ? x + colWidth(col.width) - 8 - w.font.widthOfTextAtSize(value, w.fontSize) : x;
      w.text(value, textX, w.y);
      x += colWidth(col.width);
    }
    w.y -= w.rowHeight;
  }
  w.y -= 10;
}

/** Height a table needs at scale 1: header row + one row per entry + gap. */
function tableHeight(rowCount: number): number {
  return ROW_HEIGHT * (rowCount + 1) + 10;
}

/**
 * Tabellenspalten wie in der Vorlage: führender Rang, dann die Mannschaft und
 * die Zahlen rechtsbündig. Wird sowohl für das Gesamtergebnis als auch für
 * den Tabellenstand im Wochenbericht verwendet.
 */
function tableColumns(w: PageWriter, rows: TableRow[]) {
  const rankWidth = columnWidth(w.bold, "", rows.map((_, i) => String(i + 1)), FONT_SIZE, 14);
  const teamWidth = columnWidth(w.bold, "Mannschaft", rows.map((r) => r.team), FONT_SIZE, 24);
  const numWidth = 55;
  return [
    { header: "", width: rankWidth, get: (_r: TableRow, i: number) => String(i + 1) },
    { header: "Mannschaft", width: teamWidth, get: (r: TableRow) => r.team },
    { header: "Gewonnen", width: numWidth, align: "right" as const, get: (r: TableRow) => String(r.win) },
    { header: "Verloren", width: numWidth, align: "right" as const, get: (r: TableRow) => String(r.loose) },
    { header: "Unentschieden", width: numWidth + 20, align: "right" as const, get: (r: TableRow) => String(r.tied) },
    { header: "Ringe", width: numWidth + 10, align: "right" as const, get: (r: TableRow) => formatDe(r.rings) },
    { header: "Punkte", width: numWidth, align: "right" as const, get: (r: TableRow) => String(r.points) },
  ];
}

function drawResultTable(w: PageWriter, season: PdfSeason, rows: TableRow[], logoImage: PDFImage | null) {
  w.newPage();
  drawHeading(w, season, "Gesamtergebnis", logoImage);
  drawSection(w, tableHeight(rows.length), () => drawTable(w, tableColumns(w, rows), rows));
}

function drawPersonalScores(w: PageWriter, season: PdfSeason, ageGroup: string, rows: PersonalScoreRow[], logoImage: PDFImage | null) {
  if (rows.length === 0) return;
  w.newPage();
  drawHeading(w, season, `Einzelergebnisse ${ageGroup}`, logoImage);

  const rankWidth = columnWidth(w.bold, "", rows.map((_, i) => String(i + 1)), FONT_SIZE, 14);
  const shooterWidth = columnWidth(w.bold, "Schütze/inn", rows.map((r) => r.shooter));
  const teamWidth = columnWidth(w.bold, "Mannschaft", rows.map((r) => r.team));

  // Eine Spalte je Wettkampfwoche, wie auf Blatt 2/3 der Vorlage.
  // Defensiv: ein fehlendes byWeek darf höchstens die Wochenspalten kosten,
  // niemals den ganzen Export zum Absturz bringen.
  const weekCount = rows.reduce((max, r) => Math.max(max, r.byWeek?.length ?? 0), 0);
  // Breite aus dem tatsächlichen Text ableiten, nicht raten: sonst ragt ein
  // Wert wie "300,3" aus seiner Spalte in die Nachbarspalte hinein.
  const weekValues = rows.flatMap((r) => (r.byWeek ?? []).map((v) => (v == null ? "" : formatDe(v))));
  const weekWidth = weekCount > 0 ? columnWidth(w.bold, String(weekCount), weekValues, FONT_SIZE, 8) : 0;
  const totalWidth = rankWidth + shooterWidth + teamWidth + 70 + 60 + weekCount * weekWidth;

  const columns = [
    { header: "", width: rankWidth, get: (_r: PersonalScoreRow, i: number) => String(i + 1) },
    { header: "Schütze/inn", width: shooterWidth, get: (r: PersonalScoreRow) => r.shooter },
    { header: "Mannschaft", width: teamWidth, get: (r: PersonalScoreRow) => r.team },
    { header: "Gesamt", width: 70, align: "right" as const, get: (r: PersonalScoreRow) => formatDe(r.total) },
    { header: "Schnitt", width: 60, align: "right" as const, get: (r: PersonalScoreRow) => formatDe1(r.mean) },
    ...Array.from({ length: weekCount }, (_, i) => ({
      header: String(i + 1),
      width: weekWidth,
      align: "right" as const,
      // Wochen ohne Einsatz bleiben leer statt "0" - wie in der Vorlage.
      get: (r: PersonalScoreRow) => (r.byWeek?.[i] == null ? "" : formatDe(r.byWeek[i] as number)),
    })),
  ];

  drawSection(w, tableHeight(rows.length), () => drawTable(w, columns, rows), totalWidth);
}

/**
 * Wochenbericht wie Blatt 4 der Vorlage: Überschrift mit Wettkampfwoche und
 * Zeitraum, die Begegnungen mit beiden Ergebnissen, darunter der
 * Tabellenstand nach dieser Woche.
 */
function drawWeekReport(
  w: PageWriter,
  season: PdfSeason,
  report: NonNullable<PdfSections["weekReport"]>,
  logoImage: PDFImage | null,
) {
  const from = formatDate(report.date);
  const to = formatDate(report.dateGuest);
  // Zeitraum steht in der Vorlage direkt unter der Wochenüberschrift.
  const span = from && to ? `${from} - ${to}` : from || to;

  w.newPage();
  drawHeading(w, season, `Wettkampfwoche ${report.week}`, logoImage, span || undefined);

  if (report.results.length > 0) {
    const homeWidth = columnWidth(w.bold, "Heimmannschaft", report.results.map((r) => r.homeTeam), FONT_SIZE, 24);
    const guestWidth = columnWidth(w.bold, "Gastmannschaft", report.results.map((r) => r.guestTeam), FONT_SIZE, 24);
    drawSection(w, tableHeight(report.results.length), () =>
      drawTable(
        w,
        [
          { header: "Heimmannschaft", width: homeWidth, get: (r: WeekResultRow) => r.homeTeam },
          { header: "Ergebnis", width: 70, align: "right" as const, get: (r: WeekResultRow) => formatDe(r.homeScore) },
          { header: "Gastmannschaft", width: guestWidth, get: (r: WeekResultRow) => r.guestTeam },
          { header: "Ergebnis", width: 70, align: "right" as const, get: (r: WeekResultRow) => formatDe(r.guestScore) },
        ],
        report.results,
      ),
    );
  }

  if (report.table.length > 0) {
    w.y -= 6;
    drawSection(w, 22 + tableHeight(report.table.length), () => {
      w.text(`Tabelle nach der ${report.week}. Wettkampfwoche`, PAGE_MARGIN, w.y, { size: 12, bold: true });
      w.y -= 22 * w.scale;
      drawTable(w, tableColumns(w, report.table), report.table);
    });
  }
}

// One matchday block in the Meppen layout: a date column on the left, then
// the home teams across the columns with the guest teams column-aligned
// below them (each column is one Begegnung). Verified against the real plan:
// column-wise home-over-guest reproduces exactly the round-robin pairings.
function drawScheduleBlock(w: PageWriter, matches: PdfMatch[]) {
  if (matches.length === 0) return;
  const dateCol = 78;
  const gridLeft = PAGE_MARGIN + dateCol;
  const gridWidth = w.width - PAGE_MARGIN - gridLeft;
  const colWidth = gridWidth / matches.length;

  const homeDate = formatDate(matches[0].date);
  const guestDate = formatDate(matches[0].dateGuest);

  // Home row.
  if (homeDate) w.text(homeDate, PAGE_MARGIN, w.y);
  matches.forEach((m, i) => w.text(m.homeTeam, gridLeft + i * colWidth, w.y));
  w.y -= w.rowHeight;
  // Guest row (falls back to the home date's line spacing when no second date).
  if (guestDate) w.text(guestDate, PAGE_MARGIN, w.y);
  matches.forEach((m, i) => w.text(m.guestTeam, gridLeft + i * colWidth, w.y));
  w.y -= w.rowHeight - 4;
  w.line(PAGE_MARGIN, w.y, w.width - PAGE_MARGIN, w.y);
  w.y -= 10;
}

/** Height of one matchday block at scale 1 (home row + guest row + rule). */
const SCHEDULE_BLOCK_HEIGHT = ROW_HEIGHT * 2 + 6;
/** Centered round heading plus its rule. */
const ROUND_HEADING_HEIGHT = 26;

function drawDates(w: PageWriter, season: PdfSeason, teams: PdfTeam[], matchesByWeek: PdfMatch[][], maxWeek: number, logoImage: PDFImage | null) {
  w.newPage();
  drawScheduleHeader(w, season, logoImage);

  // Each round is one unit: a Hinrunde must not lose its last matchday to the
  // next page. drawSection shrinks it slightly instead, and only falls back to
  // a page break when even the smallest allowed size wouldn't fit.
  for (const round of ["hin", "rueck"] as const) {
    const weeks = matchesByWeek.filter((week) => week.length > 0 && roundOfWeek(week[0].week, maxWeek) === round);
    if (weeks.length === 0) continue;
    const heading = round === "hin" ? "Hinrunde" : "Rückrunde";
    const needed = ROUND_HEADING_HEIGHT + weeks.length * SCHEDULE_BLOCK_HEIGHT + 8;

    drawSection(w, needed, () => {
      // Centered round heading between two rules, as in the printed original.
      const headingWidth = w.bold.widthOfTextAtSize(heading, 11 * w.scale);
      w.text(heading, (w.width - headingWidth) / 2, w.y, { size: 11, bold: true });
      w.y -= 12 * w.scale;
      w.line(PAGE_MARGIN, w.y, w.width - PAGE_MARGIN, w.y);
      w.y -= 14 * w.scale;
      for (const week of weeks) drawScheduleBlock(w, week);
      w.y -= 8;
    });
  }

  w.y -= 6;

  const nameWidth = columnWidth(w.bold, "Mannschaft", teams.map((t) => t.name));
  const dayWidth = columnWidth(w.bold, "Trainingstag", teams.map((t) => t.trainingDay ?? "-"));
  const timeWidth = columnWidth(w.bold, "Uhrzeit", teams.map((t) => t.trainingTime ?? "-"));
  const locationWidth = columnWidth(w.bold, "Ort", teams.map((t) => t.location ?? "-"));
  const contactWidth = columnWidth(w.bold, "Kontaktperson", teams.map((t) => t.contact ?? "-"));
  const phoneWidth = columnWidth(w.bold, "Kontakt", teams.map((t) => t.phone ?? "-"));

  // Heading (22) + the table itself - kept together for the same reason.
  drawSection(w, 22 + tableHeight(teams.length), () => {
    w.text("Mannschaften", PAGE_MARGIN, w.y, { size: 14, bold: true });
    w.y -= 22 * w.scale;
    drawTable(
      w,
      [
        { header: "Mannschaft", width: nameWidth, get: (t: PdfTeam) => t.name },
        { header: "Trainingstag", width: dayWidth, get: (t: PdfTeam) => t.trainingDay ?? "-" },
        { header: "Uhrzeit", width: timeWidth, get: (t: PdfTeam) => t.trainingTime ?? "-" },
        { header: "Ort", width: locationWidth, get: (t: PdfTeam) => t.location ?? "-" },
        { header: "Kontaktperson", width: contactWidth, get: (t: PdfTeam) => t.contact ?? "-" },
        { header: "Kontakt", width: phoneWidth, get: (t: PdfTeam) => t.phone ?? "-" },
      ],
      teams,
    );
  });
}

// PNG has a fixed 8-byte signature; anything else we optimistically try as
// JPG. A logo that embeds as neither is dropped rather than failing the whole
// export.
async function embedLogo(doc: PDFDocument, logo: Uint8Array | null | undefined): Promise<PDFImage | null> {
  if (!logo || logo.length < 8) return null;
  const isPng = logo[0] === 0x89 && logo[1] === 0x50 && logo[2] === 0x4e && logo[3] === 0x47;
  try {
    return isPng ? await doc.embedPng(logo) : await doc.embedJpg(logo);
  } catch {
    return null;
  }
}

export async function generateSeasonPdf(season: PdfSeason, sections: PdfSections): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new PageWriter(doc, font, bold);

  const logoImage = await embedLogo(doc, season.logo);
  if (sections.dates) drawDates(w, season, sections.dates.teams, sections.dates.matchesByWeek, sections.dates.maxWeek, logoImage);
  if (sections.resultTable) drawResultTable(w, season, sections.resultTable, logoImage);
  if (sections.personalScores) {
    for (const ageGroup of new Set(sections.personalScores.map((s) => s.ageGroup))) {
      drawPersonalScores(w, season, ageGroup, sections.personalScores.filter((s) => s.ageGroup === ageGroup), logoImage);
    }
  }
  if (sections.weekReport) drawWeekReport(w, season, sections.weekReport, logoImage);

  return doc.save();
}
