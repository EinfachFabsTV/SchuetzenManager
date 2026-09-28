export type KnownShooter = { firstName: string; lastName: string };

/** Anzeigeform der Vorschläge: "Nachname, Vorname". */
export function formatShooter(s: KnownShooter): string {
  const last = s.lastName.trim();
  const first = s.firstName.trim();
  if (!last) return first;
  if (!first) return last;
  return `${last}, ${first}`;
}

const MAX_SUGGESTIONS = 8;

/**
 * Passende Namen zur Eingabe. Gesucht wird in Vor- und Nachname, damit es
 * gleich ist, in welchem der beiden Felder getippt wird. Treffer am
 * Wortanfang stehen oben - wer "Mü" tippt, meint eher "Müller" als "Schmü".
 */
export function filterShooters(all: KnownShooter[], query: string): KnownShooter[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];

  const scored: { shooter: KnownShooter; rank: number }[] = [];
  for (const s of all) {
    const first = s.firstName.toLowerCase();
    const last = s.lastName.toLowerCase();
    const startsWith = last.startsWith(q) || first.startsWith(q);
    const contains = last.includes(q) || first.includes(q);
    if (!startsWith && !contains) continue;
    scored.push({ shooter: s, rank: startsWith ? 0 : 1 });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || formatShooter(a.shooter).localeCompare(formatShooter(b.shooter), "de"))
    .slice(0, MAX_SUGGESTIONS)
    .map((x) => x.shooter);
}
