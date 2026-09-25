// Ringzahlen sind Zehntel (z. B. 315,3). Sie werden über viele Wettkämpfe
// aufsummiert, und binäre Fließkommazahlen driften dabei: 932,4 wurde so zu
// 932.4000000000001 und hat im PDF sogar die Spalten verschoben. Deshalb wird
// nach jeder Summe auf eine Nachkommastelle zurückgeholt.
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// Die Vereinsvorlage schreibt Zahlen deutsch: Dezimalkomma, Tausenderpunkt,
// und eine Nachkommastelle nur dort, wo sie gebraucht wird (13.189,7 – aber
// 13.080 und 925).
const general = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

// Der Schnitt steht in der Vorlage immer mit genau einer Nachkommastelle,
// auch wenn sie null ist (311,0) – sonst wirkt die Spalte unruhig.
const oneDecimal = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatDe(value: number): string {
  if (!Number.isFinite(value)) return "";
  return general.format(round1(value));
}

export function formatDe1(value: number): string {
  if (!Number.isFinite(value)) return "";
  return oneDecimal.format(round1(value));
}
