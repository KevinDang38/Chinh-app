// Tournament actions, run on the server so hosts can't hand-edit results.
// Every action checks the caller hosts the event (or is an admin).
import { AppError, recordMatch, requireHost, type Db } from "./match.ts";
import {
  advanceRound, applyScore, buildBracket, memberIds, pairTeams, rollbackRound, swapPlayers, teamsMatchRoster,
  type Bracket, type Entry, type Person, type Team,
} from "./bracket.ts";

const isDoubles = (ev: { format?: string; event_type?: string }) => (ev.format || ev.event_type || "").toLowerCase() === "doubles";

async function approvedPlayers(admin: Db, eventId: string): Promise<Person[]> {
  const { data, error } = await admin.from("event_participants")
    .select("user_id, profiles!inner(display_name, rating)").eq("event_id", eventId).eq("status", "approved");
  if (error) throw new AppError("Could not load players");
  // deno-lint-ignore no-explicit-any
  return data.map((p: any) => ({ user_id: p.user_id, name: p.profiles.display_name, rating: Number(p.profiles.rating ?? 3.5) }));
}

async function save(admin: Db, eventId: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("events").update(patch).eq("id", eventId);
  if (error) throw new AppError("Could not save the event");
}

export async function bracketAction(admin: Db, callerId: string, b: Record<string, unknown>) {
  const eventId = b.eventId as string;
  const ev = await requireHost(admin, callerId, eventId);
  const bracket = ev.bracket_data as Bracket | null;

  switch (b.action) {
    // ---- doubles teams (before the bracket exists) ----
    case "teams.pair": {
      if (bracket) throw new AppError("The bracket is already generated");
      const teams = pairTeams(await approvedPlayers(admin, eventId));
      await save(admin, eventId, { teams });
      return { teams };
    }
    case "teams.swap": {
      if (bracket) throw new AppError("The bracket is already generated");
      const teams = swapPlayers(ev.teams as Team[], b.a as string, b.b as string);
      await save(admin, eventId, { teams });
      return { teams };
    }

    // ---- bracket ----
    case "bracket.generate": {
      if (bracket) throw new AppError("The bracket is already generated");
      if (ev.status !== "registration_closed") throw new AppError("Close registration first");
      const players = await approvedPlayers(admin, eventId);
      let entries: Entry[];
      if (isDoubles(ev)) {
        const teams = ev.teams as Team[] | null;
        if (!teamsMatchRoster(teams, players.map((p) => p.user_id))) throw new AppError("The roster changed. Pair the teams again.", "teams_stale");
        entries = teams!.map((t) => ({ ...t }));
      } else {
        entries = players.map((p) => ({ id: p.user_id, ...p }));
      }
      const next = buildBracket(entries);
      await save(admin, eventId, { bracket_data: next, status: "live" });
      return { bracket: next };
    }
    case "bracket.score": {
      if (!bracket || bracket.champion) throw new AppError("The bracket isn't open for scores");
      const s1 = Number(b.s1), s2 = Number(b.s2);
      let r;
      try { r = applyScore(bracket, b.matchId as string, s1, s2); } catch (e) { throw new AppError((e as Error).message, "invalid_score"); }
      let warning: string | null = null;
      if (r.firstSave) {
        // Ratings move only on the first save of a result, like before.
        const rec = await recordMatch(admin, {
          teamA: memberIds(r.match.player1!), teamB: memberIds(r.match.player2!),
          scoreA: s1, scoreB: s2, context: "tournament", eventId,
        });
        for (const e of [r.match.player1!, r.match.player2!]) {
          if (e.players) for (const p of e.players) p.rating = rec.byId[p.user_id]?.after ?? p.rating;
          else if (e.user_id) e.rating = rec.byId[e.user_id]?.after ?? e.rating;
        }
      } else {
        warning = "score_updated_no_rating";
      }
      await save(admin, eventId, { bracket_data: r.bracket });
      return { bracket: r.bracket, warning };
    }
    case "bracket.advance": {
      if (!bracket) throw new AppError("No bracket yet");
      let next;
      try { next = advanceRound(bracket); } catch (e) { throw new AppError((e as Error).message); }
      await save(admin, eventId, next.champion ? { bracket_data: next, status: "completed" } : { bracket_data: next });
      return { bracket: next };
    }
    case "bracket.rollback": {
      if (!bracket) throw new AppError("No bracket yet");
      let next;
      try { next = rollbackRound(bracket); } catch (e) { throw new AppError((e as Error).message); }
      await save(admin, eventId, { bracket_data: next, status: "live" });
      return { bracket: next };
    }
    case "bracket.reset": {
      await save(admin, eventId, { bracket_data: null, status: "registration_closed" });
      return { bracket: null };
    }
    default:
      throw new AppError("Unknown action");
  }
}
