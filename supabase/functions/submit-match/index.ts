// submit-match: the one server entry point for anything that changes ratings or results.
//
//   (no action)        casual / live-lobby match  — body: { scoreA, scoreB, playerAId, partnerId?, opp1Id?, opp2Id?, matchType?, isLive?, lobbyPin? }
//   "claim"            guest takes their spot     — body: { matchId, slot }
//   "teams.pair"       doubles: auto-balance teams — body: { eventId }
//   "teams.swap"       doubles: swap two players  — body: { eventId, a, b }
//   "bracket.generate" | "bracket.score" | "bracket.advance" | "bracket.rollback" | "bracket.reset"
//                      tournament, host only      — body: { eventId, matchId?, s1?, s2? }
//
// Errors come back as { error, code } (e.g. code "cooldown" with { wait } minutes).
import { createClient } from "npm:@supabase/supabase-js@2";
import { AppError, claim, submit } from "./match.ts";
import { bracketAction } from "./actions.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ error: "Please sign in", code: "auth" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json();
    const action = String(body.action ?? "");
    if (action === "claim") return json(await claim(admin, user.id, body));
    if (action.startsWith("teams.") || action.startsWith("bracket.")) return json(await bracketAction(admin, user.id, body));
    return json(await submit(admin, user.id, body));
  } catch (e) {
    // Errors are returned with 200 so the app can read { error, code } (supabase-js hides bodies of non-2xx).
    if (e instanceof AppError) return json({ error: e.message, code: e.code, ...e.extra });
    console.error(e);
    return json({ error: "Something went wrong", code: "server" });
  }
});
