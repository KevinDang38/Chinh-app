// Chình rating engine — Glicko-style, on the DUPR scale (2.0–8.0).
// Pure functions, no I/O: used by the submit-match edge function and by the history replay.
//
// Three "dynamic" parts:
//  1. Adaptive per player: every player has a rating AND an uncertainty (rd).
//     New / inactive players have a high rd and move fast; regulars have a low rd and move slowly.
//  2. Match context: tournament matches and longer games (to 15 / 21) count for more.
//  3. Doubles partner-aware: each partner is judged against an expectation that sits between
//     their own rating and the team average, so the stronger partner is expected to carry more.

export const SETTINGS = {
  defaultRating: 3.5,
  scale: 1.0,          // rating gap at which the favourite is expected to win 10:1
  rdMax: 0.5,          // uncertainty of a brand-new (or long-inactive) player
  rdMin: 0.15,         // floor, so regulars still move a little
  rdGrowthPerDay: 0.000623, // rd² added per idle day: rdMin -> rdMax after ~1 year off
  winWeight: 0.7,      // actual result = 70% win/loss + 30% share of points
  contextWeight: { casual: 1.0, tournament: 1.25 } as Record<string, number>,
  gameToWeight: { 11: 1.0, 15: 1.15, 21: 1.3 } as Record<number, number>,
  minRating: 1.0,
  maxRating: 8.0,
};

export type Player = { id: string | null; rating: number; rd: number; lastPlayedAt?: string | null };
export type MatchInput = {
  teamA: Player[];     // 1 or 2 players
  teamB: Player[];
  scoreA: number;
  scoreB: number;
  context: 'casual' | 'tournament';
  playedAt: Date;
};
export type PlayerResult = { id: string; before: number; after: number; change: number; rdBefore: number; rdAfter: number };

// ---- score rules -------------------------------------------------------------

/** Returns the game target (11/15/21) or throws if the score isn't a valid pickleball game. */
export function gameTarget(scoreA: number, scoreB: number): number {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) throw new Error('Scores must be whole numbers');
  if (scoreA < 0 || scoreB < 0) throw new Error('Scores cannot be negative');
  if (scoreA === scoreB) throw new Error('A game cannot end in a tie');
  const hi = Math.max(scoreA, scoreB), lo = Math.min(scoreA, scoreB), diff = hi - lo;
  if (hi > 50) throw new Error('Score too high');
  for (const t of [11, 15, 21]) if (hi === t && diff >= 2) return t;          // normal finish
  if (diff === 2 && hi > 11) {                                              // win-by-2 overtime
    const t = [21, 15, 11].find((t) => t < hi)!;
    if (lo >= t - 1) return t;
  }
  throw new Error('Not a valid pickleball score (games go to 11, 15 or 21, win by 2)');
}

// ---- Glicko helpers ------------------------------------------------------------

const q = (s: number) => Math.LN10 / s;
const g = (rd: number, s: number) => 1 / Math.sqrt(1 + (3 * q(s) ** 2 * rd ** 2) / Math.PI ** 2);
const expected = (r: number, rOpp: number, rdOpp: number, s: number) =>
  1 / (1 + Math.pow(10, (-g(rdOpp, s) * (r - rOpp)) / s));

/** Uncertainty grows while a player is inactive. */
export function inflateRd(p: Player, now: Date, S = SETTINGS): number {
  const rd = Number.isFinite(p.rd) ? p.rd : S.rdMax;
  if (!p.lastPlayedAt) return Math.min(rd, S.rdMax);
  const days = Math.max(0, (now.getTime() - new Date(p.lastPlayedAt).getTime()) / 86_400_000);
  return Math.min(Math.sqrt(rd ** 2 + S.rdGrowthPerDay * days), S.rdMax);
}

// ---- main ----------------------------------------------------------------------

export function rateMatch(m: MatchInput, S = SETTINGS): { target: number; weight: number; results: PlayerResult[] } {
  const target = gameTarget(m.scoreA, m.scoreB);
  const weight = (S.contextWeight[m.context] ?? 1) * (S.gameToWeight[target] ?? 1);

  // Guests (id === null) play as an unknown default player: average rating, maximum uncertainty.
  const prep = (team: Player[]) =>
    team.map((p) => ({ ...p, rd: p.id ? inflateRd(p, m.playedAt, S) : S.rdMax, rating: p.id ? p.rating : S.defaultRating }));
  const A = prep(m.teamA), B = prep(m.teamB);

  const teamRating = (t: typeof A) => t.reduce((s, p) => s + p.rating, 0) / t.length;
  const teamRd = (t: typeof A) => Math.sqrt(t.reduce((s, p) => s + p.rd ** 2, 0) / t.length);

  const total = m.scoreA + m.scoreB;
  const actualA = S.winWeight * (m.scoreA > m.scoreB ? 1 : 0) + (1 - S.winWeight) * (m.scoreA / total);

  const rateSide = (side: typeof A, opp: typeof A, actual: number): PlayerResult[] => {
    const rTeam = teamRating(side), rOpp = teamRating(opp), rdOpp = teamRd(opp);
    return side.filter((p) => p.id).map((p) => {
      // Partner-aware: expectation sits halfway between own rating and team average (singles: own rating).
      const rEff = side.length > 1 ? (p.rating + rTeam) / 2 : p.rating;
      const E = expected(rEff, rOpp, rdOpp, S.scale);
      const gO = g(rdOpp, S.scale);
      const info = q(S.scale) ** 2 * gO ** 2 * E * (1 - E) * weight; // = 1/d², scaled by match weight
      const precision = 1 / p.rd ** 2 + info;
      const change = (q(S.scale) / precision) * gO * weight * (actual - E);
      const after = Math.min(S.maxRating, Math.max(S.minRating, p.rating + change));
      const rdAfter = Math.max(S.rdMin, Math.sqrt(1 / precision));
      return { id: p.id!, before: p.rating, after: round3(after), change: round3(after - p.rating), rdBefore: round3(p.rd), rdAfter: round3(rdAfter) };
    });
  };

  return { target, weight, results: [...rateSide(A, B, actualA), ...rateSide(B, A, 1 - actualA)] };
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;
