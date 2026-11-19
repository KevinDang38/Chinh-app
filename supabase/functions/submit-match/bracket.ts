// Chình tournament brackets — pure functions (no I/O), used by actions.ts and the tests.
//
// A bracket entry is a single player (singles) or a 2-player team (doubles):
//   singles: { id: user_id, user_id, name, rating }
//   doubles: { id: "t3", name: "an & binh", rating: avg, players: [{ user_id, name, rating }, ...] }
// Brackets saved before teams existed have entries with user_id/email and no id; entryId() handles both.
import { gameTarget } from "./rating.ts";

export type Person = { user_id: string; name: string; rating: number };
export type Entry = { id?: string; user_id?: string; name?: string; email?: string; rating?: number; players?: Person[] };
export type BracketMatch = {
  match_id: string;
  player1: Entry | null;
  player2: Entry | null;
  score1: number;
  score2: number;
  status: "pending" | "completed";
  winner_id: string | null;
  is_bye: boolean;
};
export type Bracket = { rounds: Record<string, BracketMatch[]>; current_round: number; champion: string | null };
export type Team = { id: string; name: string; rating: number; players: Person[] };

export const entryId = (e: Entry | null | undefined) => (e ? e.id ?? e.user_id ?? null : null);
export const memberIds = (e: Entry) => (e.players ? e.players.map((p) => p.user_id) : [e.user_id!]);
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Standard seeding order, e.g. size 8 -> [1, 8, 4, 5, 2, 7, 3, 6] (seed 1 and 2 can only meet in the final). */
export function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const len = order.length * 2 + 1;
    order = order.flatMap((s) => [s, len - s]);
  }
  return order.slice(0, Math.max(size, 2));
}

/** Pair players strongest-with-weakest so every team has a similar average rating. */
export function pairTeams(players: Person[]): Team[] {
  if (players.length < 4) throw new Error("Doubles needs at least 4 approved players");
  if (players.length % 2 !== 0) throw new Error("Doubles needs an even number of approved players");
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const teams: Team[] = [];
  for (let i = 0; i < sorted.length / 2; i++) teams.push(makeTeam(`t${i + 1}`, [sorted[i], sorted[sorted.length - 1 - i]]));
  return teams;
}

function makeTeam(id: string, players: Person[]): Team {
  return { id, players, name: players.map((p) => p.name).join(" & "), rating: round3(players.reduce((s, p) => s + p.rating, 0) / players.length) };
}

/** Swap two players between their teams (host adjustment before the bracket is generated). */
export function swapPlayers(teams: Team[], a: string, b: string): Team[] {
  const ta = teams.findIndex((t) => t.players.some((p) => p.user_id === a));
  const tb = teams.findIndex((t) => t.players.some((p) => p.user_id === b));
  if (ta < 0 || tb < 0) throw new Error("Player is not in a team");
  if (ta === tb) throw new Error("Those players are already partners");
  const next = clone(teams);
  const ia = next[ta].players.findIndex((p) => p.user_id === a);
  const ib = next[tb].players.findIndex((p) => p.user_id === b);
  [next[ta].players[ia], next[tb].players[ib]] = [next[tb].players[ib], next[ta].players[ia]];
  next[ta] = makeTeam(next[ta].id, next[ta].players);
  next[tb] = makeTeam(next[tb].id, next[tb].players);
  return next;
}

/** True when the teams contain exactly these players (no one missing, no one extra). */
export function teamsMatchRoster(teams: Team[] | null | undefined, userIds: string[]): boolean {
  if (!teams?.length) return false;
  const inTeams = teams.flatMap((t) => t.players.map((p) => p.user_id)).sort();
  return JSON.stringify(inTeams) === JSON.stringify([...userIds].sort());
}

/** Seed entries by rating and build every round. Byes advance automatically. */
export function buildBracket(entries: Entry[]): Bracket {
  if (entries.length < 2) throw new Error("Not enough entries to make a bracket");
  const seeded = [...entries].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const size = Math.pow(2, Math.ceil(Math.log2(seeded.length)));
  const totalRounds = Math.log2(size);
  const rounds: Record<string, BracketMatch[]> = {};
  for (let r = 1, count = size / 2; r <= totalRounds; r++, count /= 2) {
    rounds[r] = Array.from({ length: count }, (_, m) => ({
      match_id: `r${r}_m${m + 1}`, player1: null, player2: null, score1: 0, score2: 0, status: "pending", winner_id: null, is_bye: false,
    }));
  }
  const order = seedOrder(size);
  for (let i = 0; i < size; i += 2) {
    const p1 = seeded[order[i] - 1] ?? null;
    const p2 = seeded[order[i + 1] - 1] ?? null;
    const m = rounds[1][i / 2];
    m.player1 = p1;
    m.player2 = p2;
    if (!p1 || !p2) {
      const w = p1 || p2;
      Object.assign(m, { is_bye: true, status: "completed", winner_id: entryId(w) });
      if (totalRounds > 1) {
        const next = rounds[2][Math.floor(i / 4)];
        if ((i / 2) % 2 === 0) next.player1 = w;
        else next.player2 = w;
      }
    }
  }
  const allByes = rounds[1].every((m) => m.status === "completed");
  return { rounds, current_round: allByes && totalRounds > 1 ? 2 : 1, champion: null };
}

/** Record a score in the current round. Returns whether this is the first save (ratings change only then). */
export function applyScore(bracket: Bracket, matchId: string, s1: number, s2: number) {
  const b = clone(bracket);
  const m = b.rounds[b.current_round]?.find((x) => x.match_id === matchId);
  if (!m) throw new Error("Only matches in the current round can be scored");
  if (m.is_bye || !m.player1 || !m.player2) throw new Error("This match has no opponent yet");
  gameTarget(s1, s2); // throws if not a valid pickleball score
  const firstSave = m.status === "pending";
  Object.assign(m, { score1: s1, score2: s2, status: "completed", winner_id: entryId(s1 > s2 ? m.player1 : m.player2) });
  return { bracket: b, match: m, firstSave };
}

/** Lock the current round: winners move on, or the final crowns the champion. */
export function advanceRound(bracket: Bracket): Bracket {
  const b = clone(bracket);
  const curr = b.current_round;
  const total = Object.keys(b.rounds).length;
  const matches = b.rounds[curr];
  if (!matches.every((m) => m.status === "completed")) throw new Error("Finish every match in this round first");
  if (curr === total) {
    b.champion = matches[0].winner_id;
    return b;
  }
  const winner = (m: BracketMatch) => (entryId(m.player1) === m.winner_id ? m.player1 : m.player2);
  for (let i = 0; i < matches.length; i += 2) {
    const next = b.rounds[curr + 1][i / 2];
    next.player1 = winner(matches[i]);
    next.player2 = winner(matches[i + 1]);
  }
  b.current_round = curr + 1;
  return b;
}

/** Undo the last round lock: the current round is cleared and the previous one becomes current. */
export function rollbackRound(bracket: Bracket): Bracket {
  const b = clone(bracket);
  if (b.current_round <= 1) throw new Error("Already at the first round");
  for (const m of b.rounds[b.current_round]) Object.assign(m, { player1: null, player2: null, score1: 0, score2: 0, status: "pending", winner_id: null });
  b.champion = null;
  b.current_round -= 1;
  return b;
}
