"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext";
import { Avatar, displayName, Page, Segmented, ScoreStepper, Sheet, Change } from "../components/ui";

// ---------- small pieces ----------
function PlayerLine({ email, label, you, t }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar email={email} you={you} />
      <div className="min-w-0">
        <p className="text-[0.8125rem] faint leading-tight">{label}</p>
        <p className="font-semibold truncate">{email ? displayName(email) : t("common.guest")}</p>
      </div>
    </div>
  );
}

function WaitingLine({ label, t }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar email={null} />
      <div className="min-w-0">
        <p className="text-[0.8125rem] faint leading-tight">{label}</p>
        <p className="font-semibold faint">{t("common.waiting")}</p>
      </div>
    </div>
  );
}

/** One side of the scoreboard: players on the left, score on the right. */
function Side({ title, accent, children, score, setScore, readOnlyScore, picker }) {
  return (
    <section className="panel overflow-hidden">
      <div className={`h-1.5 ${accent}`} />
      <div className="p-4">
        <h2 className="label mb-3">{title}</h2>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-3 min-w-0">{children}</div>
          {score !== undefined && <ScoreStepper value={score} onChange={setScore} label={title} readOnly={readOnlyScore} />}
        </div>
        {picker}
      </div>
    </section>
  );
}

function FriendPicker({ title, selected, onChange, excludeIds = [], friends, t }) {
  return (
    <div className="mt-4">
      <p className="text-[0.8125rem] faint mb-2">{title}</p>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
        <button type="button" className="chip shrink-0" aria-pressed={!selected} onClick={() => onChange(null)}>
          {t("common.guest")}
        </button>
        {friends.filter((f) => !excludeIds.includes(f.id)).map((f) => (
          <button key={f.id} type="button" className="chip shrink-0" aria-pressed={selected?.id === f.id} onClick={() => onChange(f)}>
            {displayName(f.email)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);

  const [viewMode, setViewMode] = useState("manual");
  const [matchType, setMatchType] = useState("1v1");
  const [teamAScore, setTeamAScore] = useState("11");
  const [teamBScore, setTeamBScore] = useState("9");

  const [partner, setPartner] = useState(null);
  const [opponent1, setOpponent1] = useState(null);
  const [opponent2, setOpponent2] = useState(null);

  const [lobbyPin, setLobbyPin] = useState(null);
  const [lobbyState, setLobbyState] = useState(null);
  const [lobbyPlayers, setLobbyPlayers] = useState({});
  const [joinPinInput, setJoinPinInput] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [pendingJoinLobby, setPendingJoinLobby] = useState(null);

  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { newRating, change }

  const [finalMatchDetails, setFinalMatchDetails] = useState(null);
  const [guestSlot, setGuestSlot] = useState(null);

  useEffect(() => {
    // A guest who joined a live match and then signed up claims their spot on the server.
    const handlePendingClaim = async () => {
      const claim = localStorage.getItem("pendingClaim");
      if (!claim) return;
      localStorage.removeItem("pendingClaim");
      try {
        const { matchId, mySlot } = JSON.parse(claim);
        const { data, error } = await supabase.functions.invoke("submit-match", { body: { action: "claim", matchId, slot: mySlot } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setResult({ newRating: data.newRating, change: data.change });
      } catch (e) {
        console.error("Failed to claim match", e);
      }
    };

    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;
      setUser(session.user);
      await handlePendingClaim();

      const { data: connections } = await supabase.from("friends").select("user_id, friend_id").or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (connections?.length) {
        const friendIds = [...new Set(connections.map((c) => (c.user_id === userId ? c.friend_id : c.user_id)))];
        const { data: friendProfiles } = await supabase.from("profiles").select("id, email, rating, profile_hash").in("id", friendIds);
        if (friendProfiles) setFriends(friendProfiles);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!lobbyPin) return;
    const channel = supabase
      .channel(`lobby-${lobbyPin}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_lobbies", filter: `pin=eq.${lobbyPin}` }, (payload) => {
        setLobbyState(payload.new);
        if (pendingJoinLobby) setPendingJoinLobby(payload.new);

        if (payload.new.status === "cancelled" && viewMode === "join") {
          alert(t("alerts.lobbyCancelled"));
          setLobbyPin(null);
          setLobbyState(null);
          setIsJoined(false);
          setPendingJoinLobby(null);
          setFinalMatchDetails(null);
        }

        if (payload.new.status === "completed" && viewMode === "join") {
          setTimeout(async () => {
            const { data } = await supabase.from("matches").select("*").eq("player_a_id", payload.new.host_id).order("created_at", { ascending: false }).limit(1).single();
            if (data) setFinalMatchDetails(data);
          }, 1000);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [lobbyPin, viewMode, pendingJoinLobby, t]);

  useEffect(() => {
    if (!lobbyState) return;
    const fetchProfiles = async () => {
      const ids = [lobbyState.host_id, lobbyState.team_a_player2_id, lobbyState.team_b_player1_id, lobbyState.team_b_player2_id].filter(Boolean);
      const { data } = await supabase.from("profiles").select("id, email, rating").in("id", ids);
      if (data) {
        const map = {};
        data.forEach((p) => (map[p.id] = p));
        setLobbyPlayers(map);
      }
    };
    fetchProfiles();
  }, [lobbyState]);

  const handleMatchTypeToggle = (type) => {
    if (matchType !== type) {
      setMatchType(type);
      setPartner(null);
      setOpponent1(null);
      setOpponent2(null);
    }
  };

  const requireAuth = (action) => (e) => {
    if (e) e.preventDefault();
    if (!user) return setShowGuestPrompt(true);
    action(e);
  };

  const hostLobby = async () => {
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const { data } = await supabase.from("match_lobbies").insert([{ pin: newPin, host_id: user.id, match_type: matchType }]).select().single();
    setLobbyPin(newPin);
    setLobbyState(data);
  };

  const cancelLobby = async () => {
    if (lobbyPin) await supabase.from("match_lobbies").update({ status: "cancelled" }).eq("pin", lobbyPin);
    setLobbyPin(null);
    setLobbyState(null);
    setLobbyPlayers({});
    setTeamAScore("11");
    setTeamBScore("9");
  };

  const joinLobby = async (e) => {
    e.preventDefault();
    const { data: lobby } = await supabase.from("match_lobbies").select("*").eq("pin", joinPinInput).eq("status", "waiting").single();
    if (!lobby) return alert(t("alerts.invalidPin"));
    if (user && user.id === lobby.host_id) return alert(t("alerts.alreadyHost"));

    if (user && [lobby.team_a_player2_id, lobby.team_b_player1_id, lobby.team_b_player2_id].includes(user.id)) {
      setLobbyPin(joinPinInput);
      setLobbyState(lobby);
      setIsJoined(true);
      return;
    }

    if (lobby.match_type === "1v1") {
      if (!lobby.team_b_player1_id) {
        completeJoin(lobby.pin, "team_b_player1_id", lobby);
      } else {
        setGuestSlot("team_b_player1_id");
        setLobbyPin(joinPinInput);
        setLobbyState(lobby);
        setIsJoined(true);
      }
    } else {
      setPendingJoinLobby(lobby);
    }
  };

  const completeJoin = async (pin, slot, lobbyData) => {
    if (user) await supabase.from("match_lobbies").update({ [slot]: user.id }).eq("pin", pin);
    else setGuestSlot(slot);
    setLobbyPin(pin);
    if (lobbyData) setLobbyState(lobbyData);
    else if (pendingJoinLobby) setLobbyState(pendingJoinLobby);
    setPendingJoinLobby(null);
    setIsJoined(true);
  };

  const handleGuestApprove = () => {
    if (!user) {
      if (finalMatchDetails && guestSlot) {
        localStorage.setItem("pendingClaim", JSON.stringify({ matchId: finalMatchDetails.id, mySlot: guestSlot }));
      }
      setShowGuestPrompt(true);
    } else {
      router.push("/dashboard");
    }
  };

  const submitMatch = async (e, isLive = false) => {
    e.preventDefault();
    const scoreA = Number(teamAScore);
    const scoreB = Number(teamBScore);
    const maxScore = Math.max(scoreA, scoreB);
    const margin = maxScore - Math.min(scoreA, scoreB);
    const isStandardWin = [11, 15, 21].includes(maxScore) && margin >= 2;
    const isOvertimeWin = maxScore > 11 && margin === 2;
    if (!isStandardWin && !isOvertimeWin) return alert(t("alerts.invalidPickleballScore"));

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-match", {
        body: {
          isLive,
          lobbyPin,
          matchType: isLive ? lobbyState.match_type : matchType,
          scoreA,
          scoreB,
          playerAId: user.id,
          partnerId: isLive ? lobbyState.team_a_player2_id : partner?.id,
          opp1Id: isLive ? lobbyState.team_b_player1_id : opponent1?.id,
          opp2Id: isLive ? lobbyState.team_b_player2_id : opponent2?.id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setResult({ newRating: data.newRating, change: data.changes?.[user.id]?.change });
    } catch (err) {
      alert(`${t("alerts.submitFailed")} ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDoubles = matchType === "2v2";
  const liveDoubles = lobbyState?.match_type === "2v2";
  const lp = (id) => lobbyPlayers[id];

  const submitButton = (live) => (
    <button onClick={requireAuth((e) => submitMatch(e, live))} disabled={isSubmitting} className="btn btn-primary w-full">
      {isSubmitting ? <span className="spinner !border-white/30 !border-t-white" /> : t("logMatch.submit")}
    </button>
  );

  return (
    <Page>
      <h1 className="title mb-4">{t("logMatch.title")}</h1>

      <Segmented
        label={t("logMatch.title")}
        value={viewMode}
        onChange={setViewMode}
        options={[
          { value: "manual", label: t("logMatch.manual") },
          { value: "host", label: t("logMatch.host") },
          { value: "join", label: t("logMatch.join") },
        ]}
      />

      <div className="mt-5">
        {/* ---------------- manual ---------------- */}
        {viewMode === "manual" && (
          <div className="flex flex-col gap-3">
            <div className="w-48 mx-auto">
              <Segmented label="Format" value={matchType} onChange={handleMatchTypeToggle}
                options={[{ value: "1v1", label: t("common.singles") }, { value: "2v2", label: t("common.doubles") }]} />
            </div>

            <Side title={t("logMatch.yourTeam")} accent="bg-volt" score={teamAScore} setScore={setTeamAScore}
              picker={isDoubles && (
                <FriendPicker title={t("logMatch.partner")} selected={partner} onChange={setPartner}
                  excludeIds={[opponent1?.id, opponent2?.id].filter(Boolean)} friends={friends} t={t} />
              )}>
              <PlayerLine email={user?.email} label={t("logMatch.you")} you t={t} />
              {isDoubles && <PlayerLine email={partner?.email} label={t("logMatch.partner")} t={t} />}
            </Side>

            <Side title={t("logMatch.opponents")} accent="bg-court" score={teamBScore} setScore={setTeamBScore}
              picker={<>
                <FriendPicker title={t("logMatch.opponent1")} selected={opponent1} onChange={setOpponent1}
                  excludeIds={[partner?.id, opponent2?.id].filter(Boolean)} friends={friends} t={t} />
                {isDoubles && (
                  <FriendPicker title={t("logMatch.opponent2")} selected={opponent2} onChange={setOpponent2}
                    excludeIds={[partner?.id, opponent1?.id].filter(Boolean)} friends={friends} t={t} />
                )}
              </>}>
              <PlayerLine email={opponent1?.email} label={t("logMatch.opponent1")} t={t} />
              {isDoubles && <PlayerLine email={opponent2?.email} label={t("logMatch.opponent2")} t={t} />}
            </Side>

            <p className="text-[0.8125rem] faint px-1">{t("logMatch.scoreHint")}</p>
            {submitButton(false)}
          </div>
        )}

        {/* ---------------- host ---------------- */}
        {viewMode === "host" && !lobbyPin && (
          <section className="panel p-5">
            <h2 className="heading">{t("logMatch.startLive")}</h2>
            <p className="muted mt-1 mb-5">{t("logMatch.hostDesc")}</p>
            <div className="w-48 mx-auto mb-5">
              <Segmented label="Format" value={matchType} onChange={handleMatchTypeToggle}
                options={[{ value: "1v1", label: t("common.singles") }, { value: "2v2", label: t("common.doubles") }]} />
            </div>
            <button onClick={requireAuth(hostLobby)} className="btn btn-primary w-full">{t("logMatch.generatePin")}</button>
          </section>
        )}

        {viewMode === "host" && lobbyPin && (
          <div className="flex flex-col gap-3">
            <section className="panel p-5 text-center">
              <p className="label">{t("logMatch.matchPin")}</p>
              <p className="num text-[3.5rem] leading-none mt-2 tracking-[0.12em]">{lobbyPin}</p>
              <p className="text-[0.8125rem] faint mt-3">{t("logMatch.pinHint")}</p>
            </section>

            <Side title={t("logMatch.teamA")} accent="bg-volt" score={teamAScore} setScore={setTeamAScore}>
              {lp(lobbyState?.host_id) ? <PlayerLine email={lp(lobbyState.host_id).email} label={t("logMatch.hostRole")} you t={t} /> : <WaitingLine label={t("logMatch.hostRole")} t={t} />}
              {liveDoubles && (lp(lobbyState?.team_a_player2_id)
                ? <PlayerLine email={lp(lobbyState.team_a_player2_id).email} label={t("logMatch.partner")} t={t} />
                : <WaitingLine label={t("logMatch.partner")} t={t} />)}
            </Side>

            <Side title={t("logMatch.teamB")} accent="bg-court" score={teamBScore} setScore={setTeamBScore}>
              {lp(lobbyState?.team_b_player1_id) ? <PlayerLine email={lp(lobbyState.team_b_player1_id).email} label={t("logMatch.p1Role")} t={t} /> : <WaitingLine label={t("logMatch.p1Role")} t={t} />}
              {liveDoubles && (lp(lobbyState?.team_b_player2_id)
                ? <PlayerLine email={lp(lobbyState.team_b_player2_id).email} label={t("logMatch.p2Role")} t={t} />
                : <WaitingLine label={t("logMatch.p2Role")} t={t} />)}
            </Side>

            <p className="text-[0.8125rem] faint px-1">{t("logMatch.unfilled")}</p>
            {submitButton(true)}
            <button onClick={cancelLobby} className="btn btn-quiet w-full">{t("logMatch.cancelLobby")}</button>
          </div>
        )}

        {/* ---------------- join ---------------- */}
        {viewMode === "join" && !isJoined && !pendingJoinLobby && (
          <form onSubmit={joinLobby} className="panel p-5">
            <h2 className="heading">{t("logMatch.joinLive")}</h2>
            <p className="muted mt-1 mb-5">{t("logMatch.joinDesc")}</p>
            <label className="sr-only" htmlFor="pin">{t("logMatch.matchPin")}</label>
            <input id="pin" type="text" inputMode="numeric" maxLength={4} required autoComplete="one-time-code"
              value={joinPinInput} onChange={(e) => setJoinPinInput(e.target.value.replace(/\D/g, ""))} placeholder="0000"
              className="field num !h-20 text-center !text-[2.75rem] tracking-[0.2em] mb-4" />
            <button type="submit" className="btn btn-primary w-full" disabled={joinPinInput.length !== 4}>{t("logMatch.findMatch")}</button>
          </form>
        )}

        {viewMode === "join" && pendingJoinLobby && !isJoined && (
          <section className="panel p-5">
            <h2 className="heading">{t("logMatch.chooseTeam")}</h2>
            <p className="muted mt-1 mb-4">{t("logMatch.selectPosition")}</p>
            <div className="flex flex-col gap-2">
              {[
                ["team_a_player2_id", `${t("logMatch.teamA")}, ${t("logMatch.partner")}`, "bg-volt"],
                ["team_b_player1_id", `${t("logMatch.teamB")}, ${t("logMatch.p1Role")}`, "bg-court"],
                ["team_b_player2_id", `${t("logMatch.teamB")}, ${t("logMatch.p2Role")}`, "bg-court"],
              ].map(([slot, title, dot]) => {
                const taken = !!pendingJoinLobby[slot];
                return (
                  <button key={slot} disabled={taken} onClick={() => completeJoin(pendingJoinLobby.pin, slot, pendingJoinLobby)}
                    className="btn btn-outline w-full !justify-between !h-14">
                    <span className="flex items-center gap-3"><span className={`w-2.5 h-2.5 rounded-full ${dot}`} />{title}</span>
                    <span className={taken ? "faint" : "text-court"}>{taken ? t("logMatch.taken") : <Plus size={20} />}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPendingJoinLobby(null)} className="btn btn-quiet w-full mt-3">{t("logMatch.cancel")}</button>
          </section>
        )}

        {viewMode === "join" && isJoined && lobbyState && (
          <div className="flex flex-col gap-3">
            <h2 className="heading">{lobbyState.status === "completed" ? t("logMatch.finalScore") : t("logMatch.liveMatch")}</h2>
            <Side title={t("logMatch.teamA")} accent="bg-volt">
              <div className="flex items-center justify-between gap-3">
                {lp(lobbyState.host_id) ? <PlayerLine email={lp(lobbyState.host_id).email} label={t("logMatch.hostRole")} t={t} /> : <WaitingLine label={t("logMatch.hostRole")} t={t} />}
                <span className="num text-[2.25rem]">{lobbyState.status === "completed" && finalMatchDetails ? finalMatchDetails.player_a_score : "–"}</span>
              </div>
            </Side>
            <Side title={t("logMatch.teamB")} accent="bg-court">
              <div className="flex items-center justify-between gap-3">
                {lp(lobbyState.team_b_player1_id) ? <PlayerLine email={lp(lobbyState.team_b_player1_id).email} label={t("logMatch.p1Role")} t={t} /> : <WaitingLine label={t("logMatch.p1Role")} t={t} />}
                <span className="num text-[2.25rem]">{lobbyState.status === "completed" && finalMatchDetails ? finalMatchDetails.player_b_score : "–"}</span>
              </div>
            </Side>
            {lobbyState.status === "completed" && finalMatchDetails ? (
              <button onClick={handleGuestApprove} className="btn btn-win w-full"><Check size={20} /> {t("logMatch.saveToProfile")}</button>
            ) : (
              <div className="flex items-center gap-3 justify-center py-4 muted"><span className="spinner" />{t("logMatch.waitingForHost")}</div>
            )}
          </div>
        )}
      </div>

      {/* ---------- saved ---------- */}
      <Sheet open={!!result} onClose={() => router.push("/dashboard")} title={t("logMatch.saved")}>
        <p className="muted">{t("logMatch.newRating")}</p>
        <div className="flex items-baseline gap-3 mt-1 mb-5">
          <span className="num text-[2.75rem] leading-none">{Number(result?.newRating ?? 0).toFixed(3)}</span>
          <Change value={result?.change} />
        </div>
        <button onClick={() => router.push("/dashboard")} className="btn btn-primary w-full">{t("logMatch.seeDashboard")}</button>
        <button onClick={() => { setResult(null); router.refresh(); }} className="btn btn-quiet w-full mt-2">{t("logMatch.logAnother")}</button>
      </Sheet>

      {/* ---------- guest prompt ---------- */}
      <Sheet open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} title={t("guest.title")}>
        <p className="muted mb-5">{t("guest.body")}</p>
        <button onClick={() => router.push("/login")} className="btn btn-primary w-full">{t("guest.cta")}</button>
        <button onClick={() => setShowGuestPrompt(false)} className="btn btn-quiet w-full mt-2">{t("guest.later")}</button>
      </Sheet>
    </Page>
  );
}
