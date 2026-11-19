// Recording matches and updating ratings (casual, live lobby, tournament) + guest claims.
import { rateMatch, SETTINGS, type Player } from "./rating.ts";

// deno-lint-ignore no-explicit-any
export type Db = any;

export class AppError extends Error {
  constructor(message: string, public code = "error", public status = 400, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Minimum time between two casual matches for the same player (anti stat-padding). */
export const COOLDOWN_MINUTES = 8;

export const SLOTS = ["player_a_id", "team_a_player2_id", "team_b_player1_id", "team_b_player2_id"] as const;
export type Slot = typeof SLOTS[number];

export async function loadPlayers(admin: Db, ids: string[]): Promise<Record<string, Player>> {
  if (!ids.length) return {};
  const { data, error } = await admin.from("profiles").select("id, rating, rating_rd, last_played_at").in("id", ids);
  if (error) throw new AppError("Could not load players");
  const map: Record<string, Player> = {};
  for (const p of data) map[p.id] = { id: p.id, rating: Number(p.rating ?? SETTINGS.defaultRating), rd: Number(p.rating_rd ?? SETTINGS.rdMax), lastPlayedAt: p.last_played_at };
  if (Object.keys(map).length !== ids.length) throw new AppError("Unknown player");
  return map;
}

export const changesJson = (results: { id: string; before: number; after: number; change: number; rdAfter: number }[]) =>
  Object.fromEntries(results.map((r) => [r.id, { before: r.before, after: r.after, change: r.change, rd: r.rdAfter }]));

async function saveResults(admin: Db, results: { id: string; after: number; rdAfter: number }[], playedAt: string) {
  for (const r of results) {
    const { error } = await admin.from("profiles").update({ rating: r.after, rating_rd: r.rdAfter, last_played_at: playedAt }).eq("id", r.id);
    if (error) throw new AppError("Could not save rating");
  }
}

/** Minutes a player still has to wait, or 0. */
export function cooldownLeft(lastPlayedAt: string | null | undefined, now: Date, minutes = COOLDOWN_MINUTES): number {
  if (!lastPlayedAt) return 0;
  const elapsed = (now.getTime() - new Date(lastPlayedAt).getTime()) / 60_000;
  return elapsed >= minutes ? 0 : Math.ceil(minutes - elapsed);
}

/**
 * Rate and store one match. teamA/teamB hold user ids or null (guest).
 * Doubles when either team has two slots.
 */
export async function recordMatch(admin: Db, m: {
  teamA: (string | null)[]; teamB: (string | null)[]; scoreA: number; scoreB: number;
  context: "casual" | "tournament"; eventId?: string | null;
}) {
  const ids = [...m.teamA, ...m.teamB].filter(Boolean) as string[];
  if (new Set(ids).size !== ids.length) throw new AppError("A player can only appear once in a match");
  const players = await loadPlayers(admin, ids);
  const playedAt = new Date();

  if (m.context === "casual") {
    const wait = Math.max(0, ...ids.map((id) => cooldownLeft(players[id].lastPlayedAt, playedAt)));
    if (wait > 0) throw new AppError(`Wait ${wait} more minute(s) before logging another match`, "cooldown", 429, { wait });
  }

  const pick = (id: string | null): Player => (id ? players[id] : { id: null, rating: SETTINGS.defaultRating, rd: SETTINGS.rdMax });
  let results;
  try {
    ({ results } = rateMatch({ teamA: m.teamA.map(pick), teamB: m.teamB.map(pick), scoreA: m.scoreA, scoreB: m.scoreB, context: m.context, playedAt }));
  } catch (e) {
    throw new AppError((e as Error).message, "invalid_score");
  }

  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const doubles = m.teamA.length > 1 || m.teamB.length > 1;
  const slots: Record<Slot, string | null> = {
    player_a_id: m.teamA[0] ?? null, team_a_player2_id: m.teamA[1] ?? null,
    team_b_player1_id: m.teamB[0] ?? null, team_b_player2_id: m.teamB[1] ?? null,
  };
  const { data: match, error } = await admin.from("matches").insert({
    match_type: doubles ? "2v2" : "1v1",
    ...slots,
    player_a_score: m.scoreA,
    player_b_score: m.scoreB,
    rating_change: slots.player_a_id ? byId[slots.player_a_id]?.change ?? null : null,
    rating_changes: changesJson(results),
    context: m.context,
    event_id: m.eventId ?? null,
    created_at: playedAt.toISOString(),
  }).select("id").single();
  if (error) throw new AppError("Could not save match");
  await saveResults(admin, results, playedAt.toISOString());
  return { matchId: match.id as string, byId, changes: changesJson(results) };
}

/** Casual or live-lobby match logged by one of its players. */
export async function submit(admin: Db, callerId: string, b: Record<string, unknown>) {
  const scoreA = Number(b.scoreA), scoreB = Number(b.scoreB);
  const s = {
    a1: (b.playerAId as string) || null, a2: (b.partnerId as string) || null,
    b1: (b.opp1Id as string) || null, b2: (b.opp2Id as string) || null,
  };
  if (!s.a1) throw new AppError("Player A is required");
  const context = b.context === "tournament" ? "tournament" : "casual";
  const eventId = (b.eventId as string) || null;
  const ids = Object.values(s).filter(Boolean) as string[];

  if (context === "tournament") {
    await requireHost(admin, callerId, eventId);
  } else if (!ids.includes(callerId)) {
    throw new AppError("You can only submit matches you played in", "forbidden", 403);
  }

  const doubles = (context === "casual" && b.matchType === "2v2") || !!s.a2 || !!s.b2;
  const r = await recordMatch(admin, {
    teamA: doubles ? [s.a1, s.a2] : [s.a1], teamB: doubles ? [s.b1, s.b2] : [s.b1],
    scoreA, scoreB, context, eventId,
  });

  if (b.isLive && b.lobbyPin) {
    await admin.from("match_lobbies").update({ status: "completed", match_id: r.matchId })
      .eq("pin", b.lobbyPin).eq("host_id", callerId).eq("status", "waiting");
  }

  const after = (id: string | null) => (id ? r.byId[id]?.after ?? null : null);
  return {
    success: true,
    matchId: r.matchId,
    newRating: after(callerId) ?? after(s.a1),
    newRatingA: after(s.a1),
    newRatingB: after(s.b1),
    changes: r.changes,
  };
}

export async function requireHost(admin: Db, callerId: string, eventId: string | null) {
  if (!eventId) throw new AppError("Missing event");
  const { data: ev } = await admin.from("events").select("*").eq("id", eventId).single();
  if (!ev) throw new AppError("Event not found", "not_found", 404);
  if (ev.host_id !== callerId) {
    const { data: me } = await admin.from("profiles").select("role").eq("id", callerId).single();
    if (me?.role !== "admin") throw new AppError("Only the event host can do this", "forbidden", 403);
  }
  return ev;
}

/** A guest who signed up afterwards takes their spot (within 24h) and gets their own rating change. */
export async function claim(admin: Db, callerId: string, b: Record<string, unknown>) {
  const slot = b.slot as Slot;
  if (!SLOTS.includes(slot)) throw new AppError("Invalid slot");
  const { data: m } = await admin.from("matches").select("*").eq("id", b.matchId).single();
  if (!m || !m.counted) throw new AppError("Match not found", "not_found", 404);
  if (m[slot]) throw new AppError("That spot is already taken");
  if (SLOTS.some((s) => m[s] === callerId)) throw new AppError("You are already in this match");
  if (Date.now() - new Date(m.created_at).getTime() > 24 * 3600_000) throw new AppError("Matches can only be claimed within 24 hours");

  const me = (await loadPlayers(admin, [callerId]))[callerId];
  const prior = (m.rating_changes ?? {}) as Record<string, { before: number; rd: number }>;
  const at = (s: Slot): Player =>
    s === slot ? me
    : m[s] ? { id: m[s], rating: prior[m[s]]?.before ?? SETTINGS.defaultRating, rd: prior[m[s]]?.rd ?? SETTINGS.rdMin }
    : { id: null, rating: SETTINGS.defaultRating, rd: SETTINGS.rdMax };
  const doubles = m.match_type === "2v2";
  const { results } = rateMatch({
    teamA: doubles ? [at("player_a_id"), at("team_a_player2_id")] : [at("player_a_id")],
    teamB: doubles ? [at("team_b_player1_id"), at("team_b_player2_id")] : [at("team_b_player1_id")],
    scoreA: m.player_a_score, scoreB: m.player_b_score, context: m.context, playedAt: new Date(m.created_at),
  });
  const mine = results.find((r) => r.id === callerId)!;

  const { error } = await admin.from("matches")
    .update({ [slot]: callerId, rating_changes: { ...prior, ...changesJson([mine]) } })
    .eq("id", m.id).is(slot, null);
  if (error) throw new AppError("Could not claim match");
  await saveResults(admin, [mine], new Date().toISOString());
  return { success: true, newRating: mine.after, change: mine.change };
}
