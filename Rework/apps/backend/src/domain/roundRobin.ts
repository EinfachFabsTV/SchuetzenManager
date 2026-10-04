// Spielplan nach der Kreismethode: eine Mannschaft steht fest, die übrigen
// rotieren Woche für Woche um sie herum. Das liefert für jede Teilnehmerzahl
// einen vollständigen Plan, in dem jede Mannschaft genau einmal gegen jede
// andere spielt.
//
// Der Vorgänger (portiert aus model/RandomRoundRobin.java) hat die Paarungen
// stattdessen ausgewürfelt und bei einer Sackgasse neu begonnen. Das lief sich
// mit wachsender Teilnehmerzahl fest: ab 12 Mannschaften scheiterten alle 500
// Anläufe, eine Saison ließ sich dann gar nicht mehr anlegen.
//
// Zufällig bleibt der Plan trotzdem - die Mannschaften gehen in gemischter
// Reihenfolge in die Rotation, sodass nicht jede Saison dieselben Paarungen
// in derselben Woche hat.

export type RRTeam = { id: number; name: string };
export type RRMatch = { homeTeamId: number; guestTeamId: number; week: number };

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Größte Heim/Gast-Differenz einer Mannschaft in der Hinrunde; kleiner ist besser. */
function homeBalancePenalty(matches: RRMatch[], weeksPerHalf: number): number {
  const balance = new Map<number, number>();
  for (const m of matches) {
    if (m.week > weeksPerHalf) break;
    balance.set(m.homeTeamId, (balance.get(m.homeTeamId) ?? 0) + 1);
    balance.set(m.guestTeamId, (balance.get(m.guestTeamId) ?? 0) - 1);
  }
  let worst = 0;
  for (const diff of balance.values()) worst = Math.max(worst, Math.abs(diff));
  return worst;
}

function buildSchedule(teams: RRTeam[]): { matches: RRMatch[]; maxWeek: number } {
  // Bei ungerader Mannschaftszahl pausiert pro Woche eine Mannschaft. Der
  // Platzhalter null macht die Zahl gerade; seine Begegnungen entfallen.
  const slots: (RRTeam | null)[] = shuffled(teams);
  if (slots.length % 2 !== 0) slots.push(null);

  const size = slots.length;
  const weeksPerHalf = size - 1;

  // Heimrecht bekommt jeweils die Mannschaft, die bisher seltener zu Hause
  // antrat. Ein festes Muster aus Woche und Platz reicht dafür nicht: durch
  // die Rotation traf es sonst einzelne Mannschaften immer wieder auswärts
  // (bei acht Mannschaften eine sogar in allen sieben Wochen der Hinrunde).
  const balance = new Map<number, number>(); // Heimspiele minus Auswärtsspiele

  const matches: RRMatch[] = [];
  for (let week = 0; week < weeksPerHalf; week++) {
    for (let i = 0; i < size / 2; i++) {
      const a = slots[i];
      const b = slots[size - 1 - i];
      if (!a || !b) continue; // spielfrei

      const diffA = balance.get(a.id) ?? 0;
      const diffB = balance.get(b.id) ?? 0;
      const aIsHome = diffA !== diffB ? diffA < diffB : Math.random() < 0.5;
      const home = aIsHome ? a : b;
      const guest = aIsHome ? b : a;

      balance.set(home.id, (balance.get(home.id) ?? 0) + 1);
      balance.set(guest.id, (balance.get(guest.id) ?? 0) - 1);
      matches.push({ homeTeamId: home.id, guestTeamId: guest.id, week: week + 1 });
    }
    // Rotation: der erste Platz bleibt besetzt, die übrigen rücken weiter.
    slots.splice(1, 0, slots.pop() as RRTeam | null);
  }

  // Rückrunde: dieselben Begegnungen mit vertauschtem Heimrecht.
  const firstHalf = matches.length;
  for (let i = 0; i < firstHalf; i++) {
    const m = matches[i];
    matches.push({ homeTeamId: m.guestTeamId, guestTeamId: m.homeTeamId, week: m.week + weeksPerHalf });
  }

  return { matches, maxWeek: weeksPerHalf * 2 };
}

// Der Ausgleich oben entscheidet Begegnung für Begegnung und kann sich dabei
// festlegen, bevor klar ist, wie die restliche Woche aussieht. Wie schon im
// Original wird deshalb aus mehreren Spielplänen der ausgewogenste genommen -
// anders als dort kann dabei aber kein Anlauf mehr scheitern.
const RUNS = 50;

export function generateSchedule(teams: RRTeam[]): { matches: RRMatch[]; maxWeek: number } {
  if (teams.length < 2) {
    return { matches: [], maxWeek: 0 };
  }

  let best = buildSchedule(teams);
  let bestPenalty = homeBalancePenalty(best.matches, best.maxWeek / 2);
  for (let i = 1; i < RUNS && bestPenalty > 1; i++) {
    const current = buildSchedule(teams);
    const penalty = homeBalancePenalty(current.matches, current.maxWeek / 2);
    if (penalty < bestPenalty) {
      best = current;
      bestPenalty = penalty;
    }
  }
  return best;
}
