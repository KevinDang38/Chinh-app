// Run: deno test supabase/functions/submit-match/
import nodeAssert from "node:assert/strict";
const assert = (c: unknown, msg?: string) => nodeAssert.ok(c, msg);
const assertEquals = <T>(a: T, b: T) => nodeAssert.deepStrictEqual(a, b);
// deno-lint-ignore no-explicit-any
const assertThrows = (fn: () => unknown, ..._rest: any[]) => nodeAssert.throws(fn);
import { gameTarget, inflateRd, rateMatch, SETTINGS, type Player } from "./rating.ts";
import { cooldownLeft } from "./match.ts";
import { advanceRound, applyScore, buildBracket, entryId, pairTeams, rollbackRound, seedOrder, swapPlayers, teamsMatchRoster } from "./bracket.ts";

const p = (id: string | null, rating = 3.5, rd = 0.5): Player => ({ id, rating, rd, lastPlayedAt: null });
const now = new Date("2026-11-19T10:00:00Z");
const single = (a: Player, b: Player, sa: number, sb: number, context: "casual" | "tournament" = "casual") =>
  rateMatch({ teamA: [a], teamB: [b], scoreA: sa, scoreB: sb, context, playedAt: now });
const change = (r: ReturnType<typeof rateMatch>, id: string) => r.results.find((x) => x.id === id)!.change;

// ---------- score rules ----------
Deno.test("valid pickleball scores", () => {
  assertEquals(gameTarget(11, 9), 11);
  assertEquals(gameTarget(0, 11), 11);
  assertEquals(gameTarget(13, 11), 11); // overtime to 11
  assertEquals(gameTarget(15, 7), 15);
  assertEquals(gameTarget(17, 15), 15);
  assertEquals(gameTarget(21, 3), 21);
  assertEquals(gameTarget(24, 22), 21);
});

Deno.test("invalid scores are rejected", () => {
  for (const [a, b] of [[11, 10], [10, 9], [11, 11], [-1, 11], [12, 9], [16, 13], [123, 9], [11.5, 9]]) {
    assertThrows(() => gameTarget(a, b), Error, undefined, `${a}-${b} should be rejected`);
  }
});

// ---------- rating ----------
Deno.test("winner gains, loser drops, equal players", () => {
  const r = single(p("a"), p("b"), 11, 9);
  assert(change(r, "a") > 0 && change(r, "b") < 0);
});

Deno.test("new players move more than settled players", () => {
  const fresh = change(single(p("a", 3.5, 0.5), p("b", 3.5, 0.3), 11, 9), "a");
  const settled = change(single(p("a", 3.5, 0.15), p("b", 3.5, 0.3), 11, 9), "a");
  assert(fresh > settled * 3, `${fresh} vs ${settled}`);
});

Deno.test("uncertainty shrinks after a match, never below the floor", () => {
  const r = single(p("a", 3.5, 0.5), p("b"), 11, 9);
  assert(r.results[0].rdAfter < 0.5);
  const settled = single(p("a", 3.5, SETTINGS.rdMin), p("b"), 11, 9);
  assertEquals(settled.results[0].rdAfter, SETTINGS.rdMin);
});

Deno.test("uncertainty grows while inactive, capped", () => {
  const year = new Date("2027-11-19T10:00:00Z");
  const grown = inflateRd({ id: "a", rating: 3.5, rd: 0.15, lastPlayedAt: now.toISOString() }, year);
  assert(grown > 0.45 && grown <= SETTINGS.rdMax);
});

Deno.test("beating a much stronger player is worth more than beating a weaker one", () => {
  const upset = change(single(p("a", 3.0, 0.3), p("b", 4.0, 0.3), 11, 9), "a");
  const expected = change(single(p("a", 4.0, 0.3), p("b", 3.0, 0.3), 11, 9), "a");
  assert(upset > expected * 3, `${upset} vs ${expected}`);
});

Deno.test("tournament and longer games weigh more", () => {
  const casual = change(single(p("a", 3.5, 0.3), p("b", 3.5, 0.3), 11, 9), "a");
  const tourney = change(single(p("a", 3.5, 0.3), p("b", 3.5, 0.3), 11, 9, "tournament"), "a");
  const to21 = change(single(p("a", 3.5, 0.3), p("b", 3.5, 0.3), 21, 19), "a");
  assert(tourney > casual && to21 > casual);
  assertEquals(rateMatch({ teamA: [p("a")], teamB: [p("b")], scoreA: 21, scoreB: 19, context: "tournament", playedAt: now }).weight, 1.25 * 1.3);
});

Deno.test("doubles: stronger partner gains less on a win", () => {
  const r = rateMatch({ teamA: [p("strong", 4.5, 0.3), p("weak", 3.0, 0.3)], teamB: [p("x", 3.75, 0.3), p("y", 3.75, 0.3)], scoreA: 11, scoreB: 9, context: "casual", playedAt: now });
  assert(change(r, "weak") > change(r, "strong"));
});

Deno.test("guests get no rating and are treated as unknown 3.5", () => {
  const r = single(p("a"), p(null), 11, 0);
  assertEquals(r.results.length, 1);
  assertEquals(r.results[0].id, "a");
});

// ---------- cooldown ----------
Deno.test("cooldown: 8 minutes between casual matches", () => {
  assertEquals(cooldownLeft(null, now), 0);
  assertEquals(cooldownLeft(new Date(now.getTime() - 3 * 60_000).toISOString(), now), 5);
  assertEquals(cooldownLeft(new Date(now.getTime() - 8 * 60_000).toISOString(), now), 0);
});

// ---------- brackets ----------
const person = (n: number) => ({ user_id: `u${n}`, name: `p${n}`, rating: 5 - n * 0.1 });
const singles = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i + 1}`, ...person(i + 1) }));

Deno.test("seed order keeps top seeds apart", () => {
  assertEquals(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  assertEquals(seedOrder(2), [1, 2]);
});

Deno.test("5 players: 8-slot bracket, top 3 seeds get byes into round 2", () => {
  const b = buildBracket(singles(5));
  assertEquals(Object.keys(b.rounds).length, 3);
  assertEquals(b.rounds[1].filter((m) => m.is_bye).length, 3);
  const r2 = b.rounds[2].flatMap((m) => [entryId(m.player1), entryId(m.player2)]).filter(Boolean).sort();
  assertEquals(r2, ["u1", "u2", "u3"]);
});

Deno.test("full tournament: score, advance, crown champion, rollback", () => {
  let b = buildBracket(singles(4));
  for (const m of b.rounds[1]) b = applyScore(b, m.match_id, 11, 5).bracket; // player1 (higher seed) wins
  b = advanceRound(b);
  assertEquals(b.current_round, 2);
  assertThrows(() => advanceRound(b)); // final not played yet
  const back = rollbackRound(b);
  assertEquals(back.current_round, 1);
  b = applyScore(b, "r2_m1", 9, 11).bracket;
  b = advanceRound(b);
  assertEquals(b.champion, "u2");
});

Deno.test("only the first save of a score counts for ratings; bad scores rejected", () => {
  const b = buildBracket(singles(2));
  const first = applyScore(b, "r1_m1", 11, 7);
  assert(first.firstSave);
  assert(!applyScore(first.bracket, "r1_m1", 11, 8).firstSave);
  assertThrows(() => applyScore(b, "r1_m1", 11, 10));
});

Deno.test("doubles teams: strongest with weakest, swap, roster check", () => {
  const players = [1, 2, 3, 4, 5, 6].map(person);
  const teams = pairTeams(players);
  assertEquals(teams.map((t) => t.players.map((x) => x.user_id)), [["u1", "u6"], ["u2", "u5"], ["u3", "u4"]]);
  const swapped = swapPlayers(teams, "u6", "u5");
  assertEquals(swapped[0].players.map((x) => x.user_id), ["u1", "u5"]);
  assert(teamsMatchRoster(teams, players.map((x) => x.user_id)));
  assert(!teamsMatchRoster(teams, ["u1", "u2"]));
  assertThrows(() => pairTeams(players.slice(0, 5)));
  const b = buildBracket(teams);
  assertEquals(entryId(b.rounds[1][0].player1), "t1");
});
