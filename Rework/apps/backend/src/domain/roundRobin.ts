// Ports model/RandomRoundRobin.java: generates a round-robin schedule via
// randomized pairing, running 2000 attempts and keeping the one with the
// best home/guest balance per team. Odd team counts get a bye each week
// (whichever team is left over once pairs are drawn simply doesn't play).

export type RRTeam = { id: number; name: string };
export type RRMatch = { homeTeamId: number; guestTeamId: number; week: number };

const RUNS = 2000;
const MAX_RESTART_ATTEMPTS = 500;

type InternalMatch = { homeIdx: number; guestIdx: number; week: number };
type Assignment = { matches: InternalMatch[]; score: number; maxWeek: number };

function randomGuestIdx(against: boolean[][], homeIdx: number, n: number): number {
  for (let i = 0; i < n * 2; i++) {
    const guestIdx = Math.floor(Math.random() * n);
    if (guestIdx !== homeIdx && !against[homeIdx][guestIdx]) return guestIdx;
  }
  for (let guestIdx = 0; guestIdx < n; guestIdx++) {
    if (guestIdx !== homeIdx && !against[homeIdx][guestIdx]) return guestIdx;
  }
  return -1;
}

function findMatch(matches: InternalMatch[], week: number, teamIdx: number) {
  return matches.find((m) => m.week === week && (m.homeIdx === teamIdx || m.guestIdx === teamIdx));
}

function randomAssignment(n: number, attempt = 0): Assignment {
  if (attempt > MAX_RESTART_ATTEMPTS) {
    throw new Error("Konnte keinen gültigen Spielplan erzeugen (zu wenige Mannschaften?)");
  }

  const maxWeekHalf = n % 2 !== 0 ? n : n - 1;
  const against: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false));
  const matches: InternalMatch[] = [];

  for (let week = 0; week < maxWeekHalf; week++) {
    let remaining = Array.from({ length: n }, (_, i) => i);
    while (remaining.length > 1) {
      const homeIdx = remaining[Math.floor(Math.random() * remaining.length)];
      let guestIdx = -1;
      let count = 0;
      let found = false;
      while (!found) {
        count++;
        guestIdx = randomGuestIdx(against, homeIdx, n);
        if (count > 100 || guestIdx === -1) {
          return randomAssignment(n, attempt + 1);
        }
        found = remaining.includes(guestIdx);
      }
      matches.push({ homeIdx, guestIdx, week: week + 1 });
      remaining = remaining.filter((idx) => idx !== homeIdx && idx !== guestIdx);
      against[homeIdx][guestIdx] = true;
      against[guestIdx][homeIdx] = true;
    }
  }

  const firstHalfCount = matches.length;
  for (let i = 0; i < firstHalfCount; i++) {
    const m = matches[i];
    matches.push({ homeIdx: m.guestIdx, guestIdx: m.homeIdx, week: m.week + maxWeekHalf });
  }

  let score = 0;
  for (let teamIdx = 0; teamIdx < n; teamIdx++) {
    let homeCount = 0;
    let guestCount = 0;
    for (let week = 0; week < maxWeekHalf; week++) {
      const match = findMatch(matches, week + 1, teamIdx);
      if (match) {
        if (match.homeIdx === teamIdx) homeCount++;
        else guestCount++;
      }
    }
    score += Math.pow(2, Math.abs(homeCount - guestCount));
  }

  return { matches, score, maxWeek: maxWeekHalf * 2 };
}

export function generateSchedule(teams: RRTeam[]): { matches: RRMatch[]; maxWeek: number } {
  if (teams.length < 2) {
    return { matches: [], maxWeek: 0 };
  }

  let best = randomAssignment(teams.length);
  for (let i = 0; i < RUNS; i++) {
    const current = randomAssignment(teams.length);
    if (current.score < best.score) best = current;
  }

  return {
    maxWeek: best.maxWeek,
    matches: best.matches.map((m) => ({
      homeTeamId: teams[m.homeIdx].id,
      guestTeamId: teams[m.guestIdx].id,
      week: m.week,
    })),
  };
}
