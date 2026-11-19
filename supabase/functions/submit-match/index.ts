// submit-match: records a match and updates ratings with the adaptive engine in rating.ts.
//
// action "submit" (default) — body: { scoreA, scoreB, playerAId, partnerId?, opp1Id?, opp2Id?,
//                                      matchType?, isLive?, lobbyPin?, context?, eventId? }
//   Casual: the caller must be one of the players.  Tournament: the caller must host the event.
// action "claim" — body: { matchId, slot }  A guest who signed up afterwards takes their slot
//   (within 24h of the match) and gets their own rating change.
import { createClient } from "npm:@supabase/supabase-js@2";
import { rateMatch, SETTINGS, type Player } from "./rating.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SLOTS = ["player_a_id", "team_a_player2_id", "team_b_player1_id", "team_b_player2_id"] as const;
type Slot = typeof SLOTS[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Please sign in" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    return body.action === "claim" ? await claim(admin, user.id, body) : await submit(admin, user.id, body);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
});

// deno-lint-ignore no-explicit-any
type Db = any;

async function loadPlayers(admin: Db, ids: string[]): Promise<Record<string, Player>> {
  if (!ids.length) return {};
  const { data, error } = await admin.from("profiles").select("id, rating, rating_rd, last_played_at").in("id", ids);
  if (error) throw new Error("Could not load players");
  const map: Record<string, Player> = {};
  for (const p of data) map[p.id] = { id: p.id, rating: Number(p.rating ?? SETTINGS.defaultRating), rd: Number(p.rating_rd ?? SETTINGS.rdMax), lastPlayedAt: p.last_played_at };
  if (Object.keys(map).length !== ids.length) throw new Error("Unknown player");
  return map;
}

async function saveResults(admin: Db, results: { id: string; after: number; rdAfter: number }[], playedAt: string) {
  for (const r of results) {
    const { error } = await admin.from("profiles").update({ rating: r.after, rating_rd: r.rdAfter, last_played_at: playedAt }).eq("id", r.id);
    if (error) throw new Error("Could not save rating");
  }
}

const changesJson = (results: { id: string; before: number; after: number; change: number; rdAfter: number }[]) =>
  Object.fromEntries(results.map((r) => [r.id, { before: r.before, after: r.after, change: r.change, rd: r.rdAfter }]));

async function submit(admin: Db, callerId: string, b: Record<string, unknown>) {
  const scoreA = Number(b.scoreA), scoreB = Number(b.scoreB);
  const slots: Record<Slot, string | null> = {
    player_a_id: (b.playerAId as string) || null,
    team_a_player2_id: (b.partnerId as string) || null,
    team_b_player1_id: (b.opp1Id as string) || null,
    team_b_player2_id: (b.opp2Id as string) || null,
  };
  const context = b.context === "tournament" ? "tournament" : "casual";
  const eventId = (b.eventId as string) || null;
  const ids = Object.values(slots).filter(Boolean) as string[];
  if (!slots.player_a_id) throw new Error("Player A is required");
  if (new Set(ids).size !== ids.length) throw new Error("A player can only appear once in a match");

  if (context === "tournament") {
    if (!eventId) throw new Error("Tournament matches need an event");
    const { data: ev } = await admin.from("events").select("host_id").eq("id", eventId).single();
    const { data: me } = await admin.from("profiles").select("role").eq("id", callerId).single();
    if (ev?.host_id !== callerId && me?.role !== "admin") throw new Error("Only the event host can enter tournament scores");
  } else if (!ids.includes(callerId)) {
    throw new Error("You can only submit matches you played in");
  }

  // Doubles if requested, or if a second player is named on either side (guests fill empty doubles slots).
  const doubles = (context === "casual" && b.matchType === "2v2") || !!slots.team_a_player2_id || !!slots.team_b_player2_id;
  const players = await loadPlayers(admin, ids);
  const pick = (id: string | null): Player => (id ? players[id] : { id: null, rating: SETTINGS.defaultRating, rd: SETTINGS.rdMax });
  const playedAt = new Date();
  const { results } = rateMatch({
    teamA: doubles ? [pick(slots.player_a_id), pick(slots.team_a_player2_id)] : [pick(slots.player_a_id)],
    teamB: doubles ? [pick(slots.team_b_player1_id), pick(slots.team_b_player2_id)] : [pick(slots.team_b_player1_id)],
    scoreA, scoreB, context, playedAt,
  });

  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const { data: match, error } = await admin.from("matches").insert({
    match_type: doubles ? "2v2" : "1v1",
    ...slots,
    player_a_score: scoreA,
    player_b_score: scoreB,
    rating_change: byId[slots.player_a_id]?.change ?? null,
    rating_changes: changesJson(results),
    context,
    event_id: eventId,
    created_at: playedAt.toISOString(),
  }).select("id").single();
  if (error) throw new Error("Could not save match");

  await saveResults(admin, results, playedAt.toISOString());
  if (b.isLive && b.lobbyPin) await admin.from("match_lobbies").update({ status: "completed" }).eq("pin", b.lobbyPin);

  const after = (id: string | null) => (id ? byId[id]?.after ?? null : null);
  return json({
    success: true,
    matchId: match.id,
    newRating: after(callerId) ?? after(slots.player_a_id),
    newRatingA: after(slots.player_a_id),
    newRatingB: after(slots.team_b_player1_id),
    changes: changesJson(results),
  });
}

async function claim(admin: Db, callerId: string, b: Record<string, unknown>) {
  const slot = b.slot as Slot;
  if (!SLOTS.includes(slot)) throw new Error("Invalid slot");
  const { data: m } = await admin.from("matches").select("*").eq("id", b.matchId).single();
  if (!m || !m.counted) throw new Error("Match not found");
  if (m[slot]) throw new Error("That spot is already taken");
  if (SLOTS.some((s) => m[s] === callerId)) throw new Error("You are already in this match");
  if (Date.now() - new Date(m.created_at).getTime() > 24 * 3600_000) throw new Error("Matches can only be claimed within 24 hours");

  // Re-rate the match from the claimer's point of view, using everyone else's ratings from the time it was played.
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
  if (error) throw new Error("Could not claim match");
  await saveResults(admin, [mine], new Date().toISOString());
  return json({ success: true, newRating: mine.after, change: mine.change });
}
