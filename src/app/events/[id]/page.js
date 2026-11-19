"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Check, X, Users, Clock, Crown, LogOut, RotateCcw, AlertTriangle, ChevronLeft } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useLanguage } from "../../../context/LanguageContext";
import { Page, Loading, Empty, Avatar, Segmented, ScoreStepper, Sheet, displayName, useDialogs } from "../../../components/ui";
import { callServer, errorText } from "../../../lib/api";
import { normalizeStatus, statusLabel, statusTag, isDoublesEvent } from "../../../lib/eventStatus";
import { locale } from "../../../lib/matchHistory";
import { PROFILE_COLUMNS } from "../../../lib/columns";

export default function EventDetails() {
  const { id } = useParams();
  const router = useRouter();
  const { t, language } = useLanguage();
  
  // 1. The High-Performance SWR Fetcher
  const fetcher = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    let userId = session?.user?.id || null;
    let currentUser = session?.user || null;
    let userProfile = null;

    if (userId) {
      const { data: prof } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single();
      userProfile = prof;
    }

    const { data: eventData, error: eventErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (eventErr || !eventData) throw new Error("Event not found");

    if (eventData.host_id) {
       const { data: hostData } = await supabase.from('profiles').select('display_name').eq('id', eventData.host_id).maybeSingle();
       eventData.host_name = hostData?.display_name || null;
    }

    const { data: partData } = await supabase
      .from('event_participants')
      .select('*, profiles!inner(display_name, rating, profile_hash)')
      .eq('event_id', id);

    return { currentUser, userProfile, event: eventData, participants: partData || [] };
  };

  // 2. The SWR Cache Engine (Polls silently every 10 seconds for live tournament feel)
  const { data, error, mutate, isLoading } = useSWR(`event-${id}`, fetcher, {
    refreshInterval: 10000, 
    revalidateOnFocus: true
  });

  const currentUser = data?.currentUser || null;
  const userProfile = data?.userProfile || null;
  const event = data?.event || null;
  const participants = data?.participants || [];

  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [adminView, setAdminView] = useState('pending'); 
  const [isEditingFee, setIsEditingFee] = useState(false);
  const [newFee, setNewFee] = useState("");

  const [matchScores, setMatchScores] = useState({});
  const [pickedRound, setViewRound] = useState(null); // null = follow the current round
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [swapPick, setSwapPick] = useState(null); // doubles: first player tapped for a swap
  const { confirm, notify, dialogs } = useDialogs();


  if (isLoading) return <Loading />;

  if (error) {
    router.push("/events");
    return null;
  }

  const requireAuth = (action) => (e) => {
    if (e) e.preventDefault();
    if (!currentUser) {
      setShowGuestPrompt(true);
      return;
    }
    action(e);
  };

  // --- SWR MUTATION WRAPPERS (Syncs Database to Cache Instantly) --- //

  const handleJoin = async () => {
    setActionLoading(true);
    const { data: existing } = await supabase.from('event_participants').select('id').eq('event_id', id).eq('user_id', currentUser.id).maybeSingle();
    if (existing) {
      await mutate(); 
      setActionLoading(false);
      return;
    }
    
    const approvedCount = participants.filter(p => p.status === 'approved').length;
    const isFull = event.max_players && approvedCount >= event.max_players;
    let joinStatus = currentUser.id === event.host_id ? 'approved' : (isFull ? 'waitlist' : 'pending');

    const { error } = await supabase.from('event_participants').insert([{ event_id: id, user_id: currentUser.id, status: joinStatus }]);
    if (error && error.code !== '23505') notify(`${t('alerts.somethingWrong')} ${error.message}`);
    
    await mutate();
    setActionLoading(false);
  };

  const handleLeaveEvent = async () => {
    if (event?.bracket_data) return notify(t('events.alerts.bracketGeneratedWithdraw'));
    if (!(await confirm({ title: t('events.buttons.withdraw'), body: t('events.alerts.confirmWithdraw'), action: t('events.buttons.withdraw'), cancel: t('logMatch.cancel'), danger: true }))) return;
    setActionLoading(true);
    const { error } = await supabase.from('event_participants').delete().eq('event_id', id).eq('user_id', currentUser.id);
    if (error) notify(`${t('alerts.somethingWrong')} ${error.message}`);
    else await mutate();
    setActionLoading(false);
  };

  const handleUpdateStatus = async (participantId, newStatus) => {
    setActionLoading(true);
    const { error } = await supabase.from('event_participants').update({ status: newStatus }).eq('id', participantId);
    if (!error) await mutate();
    setActionLoading(false);
  };

  const toggleParticipantState = async (participantId, field, currentValue) => {
    setActionLoading(true);
    const { error } = await supabase.from('event_participants').update({ [field]: !currentValue }).eq('id', participantId);
    if (!error) await mutate();
    setActionLoading(false);
  };

  const handleQuickCapacity = async (val) => {
    setActionLoading(true);
    const num = val === 'Open' ? null : parseInt(val);
    const { error } = await supabase.from('events').update({ max_players: num }).eq('id', id);
    if (!error) await mutate();
    setActionLoading(false);
  };

  const handleUpdateFee = async () => {
    setActionLoading(true);
    const { error } = await supabase.from('events').update({ entry_fee: newFee }).eq('id', id);
    if (!error) {
       await mutate();
       setIsEditingFee(false);
    }
    setActionLoading(false);
  };

  const handleUpdateEventStatus = async (newStatus) => {
    if (newStatus === 'live' && !event.bracket_data) return notify(t('events.alerts.generateBeforeLive'));
    if (newStatus === 'registration' && event.bracket_data) return notify(t('events.alerts.resetBeforeReg'));
    setActionLoading(true);
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', id);
    if (error) notify(`${t('alerts.somethingWrong')} ${error.message}`);
    else await mutate();
    setActionLoading(false);
  };

  // ---- tournament actions run on the server (host only); the page just refreshes afterwards ----
  const runAction = async (body, okMessage) => {
    setActionLoading(true);
    try {
      const data = await callServer({ eventId: id, ...body });
      const fresh = await mutate();
      if (data?.warning === 'score_updated_no_rating') notify(t('events.alerts.scoreUpdatedNoDupr'), 'ok');
      else if (okMessage) notify(okMessage, 'ok');
      return fresh;
    } catch (err) {
      notify(errorText(err, t));
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handlePairTeams = () => runAction({ action: 'teams.pair' }, t('events.teams.paired'));

  const handleSwapPick = async (userId) => {
    if (!swapPick) return setSwapPick(userId);
    if (swapPick === userId) return setSwapPick(null);
    const a = swapPick;
    setSwapPick(null);
    await runAction({ action: 'teams.swap', a, b: userId });
  };

  const handleGenerateBracket = async () => {
    if (normalizeStatus(event.status) !== 'registration_closed') return notify(t('events.alerts.statusMustBeClosed'));
    const fresh = await runAction({ action: 'bracket.generate' });
    if (fresh?.event?.bracket_data?.current_round) setViewRound(fresh.event.bracket_data.current_round);
  };

  const handleSaveScore = async (matchId) => {
    const match = event.bracket_data.rounds[event.bracket_data.current_round].find((m) => m.match_id === matchId);
    const s1 = matchScores[matchId]?.s1 ?? (match?.status === 'completed' ? String(match.score1) : '');
    const s2 = matchScores[matchId]?.s2 ?? (match?.status === 'completed' ? String(match.score2) : '');
    if (s1 === '' || s2 === '') return notify(t('events.alerts.enterBothScores'));
    const fresh = await runAction({ action: 'bracket.score', matchId, s1: Number(s1), s2: Number(s2) });
    if (fresh) setMatchScores((prev) => { const next = { ...prev }; delete next[matchId]; return next; });
  };

  const handleAdvanceRound = async () => {
    const b = event.bracket_data;
    const isFinal = b.current_round === Object.keys(b.rounds).length;
    const ok = await confirm(isFinal
      ? { title: t('events.bracket.finalizeTournament'), body: t('events.alerts.confirmCrownChampion'), action: t('events.bracket.crown'), cancel: t('logMatch.cancel') }
      : { title: t('events.bracket.approveRound'), body: t('events.alerts.confirmLockRound'), action: t('events.bracket.lockRound'), cancel: t('logMatch.cancel') });
    if (!ok) return;
    const fresh = await runAction({ action: 'bracket.advance' });
    if (fresh?.event?.bracket_data) setViewRound(fresh.event.bracket_data.current_round);
  };

  const handleRollbackRound = async () => {
    const curr = event.bracket_data.current_round;
    if (curr <= 1) return notify(t('events.alerts.cannotRollback'));
    const ok = await confirm({ title: t('events.admin.rollback'), body: `${t('events.alerts.confirmRollback')} ${getRoundName(curr - 1, Object.keys(event.bracket_data.rounds).length)}?`, action: t('events.admin.rollback'), cancel: t('logMatch.cancel'), danger: true });
    if (!ok) return;
    const fresh = await runAction({ action: 'bracket.rollback' });
    if (fresh?.event?.bracket_data) setViewRound(fresh.event.bracket_data.current_round);
  };

  const handleClearBracket = async () => {
    const ok = await confirm({ title: t('events.admin.wipeReset'), body: t('events.alerts.warningReset'), action: t('events.admin.wipeReset'), cancel: t('logMatch.cancel'), danger: true });
    if (!ok) return;
    if (await runAction({ action: 'bracket.reset' })) {
      setViewRound(1);
      setMatchScores({});
    }
  };

  const updateLocalScore = (matchId, playerNum, val) => {
    const cleanedVal = val.replace("-", "");
    setMatchScores(prev => ({ ...prev, [matchId]: { ...prev[matchId], [playerNum]: cleanedVal } }));
  };

  const getRoundName = (roundNum, totalRounds) => {
    if (roundNum === totalRounds) return t('events.bracket.finals');
    if (roundNum === totalRounds - 1 && totalRounds >= 2) return t('events.bracket.semifinals');
    if (roundNum === totalRounds - 2 && totalRounds >= 3) return t('events.bracket.quarterfinals');
    return `${t('events.bracket.roundOf')} ${Math.pow(2, totalRounds - roundNum + 1)}`;
  };

  const isEventAdmin = currentUser?.id === event?.host_id || userProfile?.role === 'admin';
  const myParticipantRecord = participants.find(p => p.user_id === currentUser?.id);
  const hasJoined = !!myParticipantRecord;
  const approvedParticipants = participants.filter(p => p.status === 'approved').sort((a, b) => (b.profiles?.rating || 0) - (a.profiles?.rating || 0));
  const pendingParticipants = participants.filter(p => p.status === 'pending');
  const waitlistParticipants = participants.filter(p => p.status === 'waitlist');
  const isFull = event.max_players && approvedParticipants.length >= event.max_players;
  const status = normalizeStatus(event?.status);
  const regOpen = status === 'registration';
  const isBracketGenerated = !!event?.bracket_data;

  let displayRegistered = approvedParticipants.length;
  if (event?.bracket_data) {
    let c = 0;
    event.bracket_data.rounds[1].forEach(m => { if (m.player1) c++; if (m.player2) c++; });
    displayRegistered = c;
  }

  const totalRounds = event?.bracket_data ? Object.keys(event.bracket_data.rounds).length : 0;
  const isBracketVisibleToUser = isEventAdmin || status === 'live' || status === 'completed';
  const visibleRounds = event?.bracket_data ? Object.keys(event.bracket_data.rounds).filter(r => Number(r) <= event.bracket_data.current_round) : [];
  const loc = locale(language);
  const viewRound = pickedRound ?? event?.bracket_data?.current_round ?? 1;
  const doublesEvent = isDoublesEvent(event);
  const teams = event?.teams || [];
  const approvedIds = approvedParticipants.map((p) => p.user_id).sort();
  const teamIds = teams.flatMap((tm) => tm.players.map((x) => x.user_id)).sort();
  const teamsReady = !doublesEvent || (teams.length > 0 && JSON.stringify(approvedIds) === JSON.stringify(teamIds));
  // bracket entries are players (singles) or teams (doubles); older brackets used user_id/email
  const entryKey = (e) => (e ? e.id ?? e.user_id ?? null : null);
  const entryName = (e) => e?.name ?? e?.email;
  const isMine = (e) => !!currentUser && (e?.players ? e.players.some((x) => x.user_id === currentUser.id) : e?.user_id === currentUser.id);
  const championEntry = event?.bracket_data?.champion
    ? Object.values(event.bracket_data.rounds).flat().flatMap((m) => [m.player1, m.player2]).find((e) => entryKey(e) === event.bracket_data.champion)
    : null;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const ParticipantRow = ({ p, idx, viewType }) => {
    const lockRoster = actionLoading || isBracketGenerated;
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3">
        {(viewType === 'public' || viewType === 'roster' || viewType === 'waitlist') && <span className="num w-7 text-center faint">{idx + 1}</span>}
        <Avatar name={p.profiles?.display_name} you={p.user_id === currentUser?.id} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{p.profiles?.display_name ? displayName(p.profiles.display_name) : t('events.details.unknownUser')}</p>
          <p className="text-[0.8125rem] faint">{t('common.rating')} <span className="num">{Number(p.profiles?.rating || 0).toFixed(3)}</span></p>
        </div>
        {viewType === 'pending' && (
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => handleUpdateStatus(p.id, 'approved')} disabled={lockRoster || isFull} className="btn btn-win btn-sm flex-1"><Check size={16} /> {t('events.buttons.approve')}</button>
            <button onClick={() => handleUpdateStatus(p.id, 'rejected')} disabled={lockRoster} className="btn btn-danger btn-sm flex-1"><X size={16} /> {t('events.buttons.reject')}</button>
          </div>
        )}
        {viewType === 'waitlist' && (
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => handleUpdateStatus(p.id, 'approved')} disabled={lockRoster || isFull} className="btn btn-win btn-sm flex-1">{t('events.buttons.promote')}</button>
            <button onClick={() => handleUpdateStatus(p.id, 'rejected')} disabled={lockRoster} className="btn btn-danger btn-sm flex-1">{t('events.buttons.remove')}</button>
          </div>
        )}
        {viewType === 'roster' && (
          <div className="flex gap-2">
            <button onClick={() => toggleParticipantState(p.id, 'has_paid', p.has_paid)} disabled={actionLoading} aria-pressed={!!p.has_paid}
              className={`btn btn-sm ${p.has_paid ? 'btn-win' : 'btn-outline'}`}>{t('events.admin.paid')}</button>
            <button onClick={() => toggleParticipantState(p.id, 'checked_in', p.checked_in)} disabled={actionLoading} aria-pressed={!!p.checked_in}
              className={`btn btn-sm ${p.checked_in ? 'btn-primary' : 'btn-outline'}`}>{t('events.admin.checkedIn')}</button>
            {p.user_id !== event.host_id && (
              <button onClick={() => handleUpdateStatus(p.id, 'rejected')} disabled={lockRoster} className="btn btn-danger btn-sm" aria-label={t('events.buttons.remove')}><X size={16} /></button>
            )}
          </div>
        )}
      </li>
    );
  };

  const tabs = [
    { id: 'overview', label: t('events.tabs.overview') },
    { id: 'participants', label: `${t('events.tabs.participants')} ${approvedParticipants.length}` },
    { id: 'bracket', label: t('events.tabs.bracket') },
    ...(isEventAdmin ? [{ id: 'admin', label: t('events.tabs.admin') }] : []),
  ];

  const joinLabel = !regOpen ? t('events.buttons.registration_closed') : isFull ? t('events.buttons.joinWaitlist') : t('events.buttons.join_event');

  return (
    <Page wide>
      <button onClick={() => router.push('/events')} className="btn btn-quiet btn-sm -ml-3 mb-2"><ChevronLeft size={18} /> {t('sidebar.events')}</button>

      {/* ---------- header ---------- */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className={`tag ${statusTag(event.status)}`}>{statusLabel(event.status, t)}</span>
          <span className="tag tag-neutral">{event.event_type === 'tournament' ? t('events.status.tournament') : t('events.status.open_play')}</span>
          <span className="tag tag-neutral">{isDoublesEvent(event) ? t('common.doubles') : t('common.singles')}</span>
        </div>
        <h1 className="title">{event.title}</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-[1fr_20rem] md:items-start">
        <dl className="panel grid grid-cols-2 gap-x-4 gap-y-4 p-5">
          {[
            [t('events.create.begin_date'), fmtDate(event.begin_date)],
            [t('events.create.location'), event.location || '—'],
            [t('events.details.hostedBy'), event.host_name ? displayName(event.host_name) : t('common.guest')],
            [t('events.details.registered'), `${displayRegistered} / ${event.max_players || '∞'}`],
            [t('events.details.ratingRange'), `${Number(event.min_dupr ?? 0).toFixed(1)} – ${Number(event.max_dupr ?? 8).toFixed(1)}`],
            [t('events.details.entryFee'), event.entry_fee || t('events.create.free')],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[0.8125rem] faint">{k}</dt>
              <dd className="font-semibold truncate">{v}</dd>
            </div>
          ))}
        </dl>

        {/* ---------- your registration ---------- */}
        <section className="panel p-5">
          {!hasJoined ? (
            <>
              <p className="muted mb-3">{regOpen ? t('events.details.joinHint') : t('events.details.closedHint')}</p>
              <button onClick={requireAuth(handleJoin)} disabled={actionLoading || !regOpen} className="btn btn-primary w-full">
                {actionLoading ? <span className="spinner !border-white/30 !border-t-white" /> : joinLabel}
              </button>
            </>
          ) : (
            <>
              <p className="label">{t('events.details.yourSpot')}</p>
              <p className="mt-1 flex items-center gap-2 font-semibold">
                {myParticipantRecord.status === 'approved' && <><Check size={18} className="text-win" /> {t('events.buttons.approved')}</>}
                {myParticipantRecord.status === 'pending' && <><Clock size={18} className="text-court" /> {t('events.buttons.pending_approval')}</>}
                {myParticipantRecord.status === 'waitlist' && <><Users size={18} className="faint" /> {t('events.buttons.onWaitlist')}</>}
                {myParticipantRecord.status === 'rejected' && <><X size={18} className="text-loss" /> {t('events.buttons.notAccepted')}</>}
              </p>
              {myParticipantRecord.status === 'approved' && event.entry_fee && <p className="text-[0.8125rem] faint mt-1">{t('events.details.payHostDirectly')}</p>}
              {regOpen && currentUser?.id !== event?.host_id && !event.bracket_data && (
                <button onClick={handleLeaveEvent} disabled={actionLoading} className="btn btn-quiet btn-sm w-full mt-3 !text-loss"><LogOut size={16} /> {t('events.buttons.withdraw')}</button>
              )}
            </>
          )}
        </section>
      </div>

      {/* ---------- tabs ---------- */}
      <div className="mt-6 -mx-4 px-4 overflow-x-auto no-scrollbar">
        <div className="seg min-w-max md:min-w-0" role="tablist">
          {tabs.map((tab) => (
            <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 whitespace-nowrap">
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'overview' && (
          <section className="panel p-5">
            <h2 className="heading">{t('events.details.welcome')}</h2>
            <p className="muted mt-2 max-w-[65ch]">
              {t('events.details.eventDesc')} {isDoublesEvent(event) ? t('common.doubles').toLowerCase() : t('common.singles').toLowerCase()}. {t('events.details.ensureDupr')} {Number(event.min_dupr ?? 0).toFixed(1)}–{Number(event.max_dupr ?? 8).toFixed(1)}.
            </p>
            {event.event_type === 'tournament' && <p className="text-[0.9375rem] faint mt-3 max-w-[65ch]">{t('events.details.tournamentWeight')}</p>}
          </section>
        )}

        {activeTab === 'participants' && doublesEvent && teams.length > 0 && (
          <ol className="grid gap-2 sm:grid-cols-2 mb-4">
            {teams.map((team, i) => (
              <li key={team.id} className="panel px-4 py-3 flex items-center gap-3">
                <span className="num w-7 text-center faint">{i + 1}</span>
                <div className="flex -space-x-2">{team.players.map((pl) => <Avatar key={pl.user_id} name={pl.name} size={32} you={pl.user_id === currentUser?.id} />)}</div>
                <span className="flex-1 truncate font-semibold">{team.name}</span>
                <span className="num">{Number(team.rating).toFixed(3)}</span>
              </li>
            ))}
          </ol>
        )}

        {activeTab === 'participants' && (
          approvedParticipants.length === 0
            ? <Empty>{t('events.details.no_players')}</Empty>
            : <ol className="panel rows">{approvedParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="public" />)}</ol>
        )}

        {activeTab === 'bracket' && (
          !event.bracket_data || !isBracketVisibleToUser ? (
            <Empty>{!event.bracket_data ? t('events.bracket.notGenerated') : t('events.bracket.hidden')}</Empty>
          ) : (
            <div>
              {event.bracket_data.champion && (
                <section className="rounded-[22px] bg-volt text-volt-ink p-5 mb-4 flex items-center gap-4">
                  <Crown size={32} />
                  <div>
                    <p className="text-[0.9375rem]">{t('events.bracket.champion')}</p>
                    <p className="num text-[1.75rem] leading-tight">
                      {displayName(entryName(championEntry), t('common.guest'))}
                    </p>
                  </div>
                </section>
              )}

              <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1 mb-4">
                {(isEventAdmin ? Object.keys(event.bracket_data.rounds) : visibleRounds).map((r) => (
                  <button key={r} className="chip shrink-0" aria-pressed={viewRound === Number(r)} onClick={() => setViewRound(Number(r))}>
                    {getRoundName(Number(r), totalRounds)}
                  </button>
                ))}
              </div>

              <ul className="grid gap-3 md:grid-cols-2">
                {event.bracket_data.rounds[viewRound]?.map((match) => {
                  const canScore = isEventAdmin && !match.is_bye && match.player1 && match.player2 && viewRound === event.bracket_data.current_round;
                  const s1 = matchScores[match.match_id]?.s1 ?? (match.status === 'completed' ? String(match.score1) : '');
                  const s2 = matchScores[match.match_id]?.s2 ?? (match.status === 'completed' ? String(match.score2) : '');
                  const row = (player, score, fallback) => {
                    const won = match.winner_id && match.winner_id === entryKey(player);
                    return (
                      <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl ${won ? 'bg-win-tint' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={entryName(player)} size={32} you={isMine(player)} />
                          <span className={`truncate ${won ? 'font-bold' : 'font-medium'} ${player ? '' : 'faint'}`}>{entryName(player) ? (player?.players ? entryName(player) : displayName(entryName(player))) : fallback}</span>
                        </div>
                        <span className="num text-lg">{match.is_bye || match.status !== 'completed' ? '–' : score}</span>
                      </div>
                    );
                  };
                  return (
                    <li key={match.match_id} className="panel p-3">
                      <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-[0.8125rem] faint">{t('events.bracket.match')} {match.match_id.split('_m')[1]}</span>
                        {match.is_bye ? <span className="tag tag-neutral">{t('events.bracket.autoAdvance')}</span>
                          : match.status === 'completed' ? <span className="tag tag-win">{t('events.bracket.final')}</span> : null}
                      </div>
                      {row(match.player1, match.score1, t('events.bracket.tbd'))}
                      {row(match.player2, match.score2, t('events.bracket.tbdBye'))}
                      {canScore && (
                        <div className="mt-2 pt-3 border-t border-line">
                          <div className="flex items-center justify-between gap-2">
                            <ScoreStepper value={s1} onChange={(v) => updateLocalScore(match.match_id, 's1', v)} label={t('events.bracket.p1Score')} />
                            <ScoreStepper value={s2} onChange={(v) => updateLocalScore(match.match_id, 's2', v)} label={t('events.bracket.p2Score')} />
                          </div>
                          <button onClick={() => handleSaveScore(match.match_id)} disabled={actionLoading} className="btn btn-outline btn-sm w-full mt-3">
                            {match.status === 'completed' ? t('events.bracket.updateScore') : t('events.bracket.saveScore')}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {isEventAdmin && viewRound === event.bracket_data.current_round && event.bracket_data.rounds[viewRound].every(m => m.status === 'completed') && !event.bracket_data.champion && (
                <section className="panel p-5 mt-4">
                  <h3 className="heading">{t('events.bracket.roundComplete')}</h3>
                  <p className="muted mt-1 mb-4">{t('events.bracket.approveNextRoundDesc')}</p>
                  <button onClick={handleAdvanceRound} disabled={actionLoading} className="btn btn-primary w-full md:w-auto">
                    {viewRound === totalRounds ? t('events.bracket.finalizeTournament') : t('events.bracket.approveRound')}
                  </button>
                </section>
              )}
            </div>
          )
        )}

        {activeTab === 'admin' && isEventAdmin && (
          <div className="flex flex-col gap-4">
            <section className="panel p-5">
              <h2 className="heading">{t('events.admin.tournamentEngine')}</h2>
              <p className="muted mt-1 mb-4">{t('events.admin.engineDesc')}</p>
              {!event.bracket_data ? (
                <>
                  <ul className="flex flex-col gap-2 mb-4 text-[0.9375rem]">
                    <li className={`flex items-center gap-2 ${status === 'registration_closed' ? 'text-win' : 'muted'}`}>
                      {status === 'registration_closed' ? <Check size={18} /> : <X size={18} />} {t('events.admin.statusMustBeClosed')}
                    </li>
                    <li className={`flex items-center gap-2 ${approvedParticipants.length >= 2 ? 'text-win' : 'muted'}`}>
                      {approvedParticipants.length >= 2 ? <Check size={18} /> : <X size={18} />} {t('events.admin.requiresPlayers')} ({approvedParticipants.length})
                    </li>
                    {doublesEvent && (
                      <li className={`flex items-center gap-2 ${teamsReady ? 'text-win' : 'muted'}`}>
                        {teamsReady ? <Check size={18} /> : <X size={18} />} {t('events.teams.ready')}
                      </li>
                    )}
                  </ul>
                  <button onClick={handleGenerateBracket} disabled={actionLoading || status !== 'registration_closed' || approvedParticipants.length < 2 || !teamsReady} className="btn btn-primary w-full">
                    {actionLoading ? t('events.buttons.processing') : t('events.admin.generateBracket')}
                  </button>
                </>
              ) : (
                <>
                  <p className="font-semibold">{t('events.admin.bracketIsLive')}</p>
                  <p className="muted text-[0.9375rem] mt-1 mb-4">{t('events.admin.bracketLiveDesc')}</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {event.bracket_data.current_round > 1 && (
                      <button onClick={handleRollbackRound} disabled={actionLoading} className="btn btn-outline"><RotateCcw size={18} /> {t('events.admin.rollback')}</button>
                    )}
                    <button onClick={handleClearBracket} disabled={actionLoading} className="btn btn-danger"><AlertTriangle size={18} /> {t('events.admin.wipeReset')}</button>
                  </div>
                </>
              )}
            </section>

            {doublesEvent && !event.bracket_data && (
              <section className="panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="heading">{t('events.teams.title')}</h2>
                    <p className="muted text-[0.9375rem] mt-1">{t('events.teams.desc')}</p>
                  </div>
                  <button onClick={handlePairTeams} disabled={actionLoading || approvedParticipants.length < 4} className="btn btn-primary btn-sm shrink-0">
                    {teams.length ? t('events.teams.repair') : t('events.teams.pair')}
                  </button>
                </div>
                {teams.length > 0 && !teamsReady && <p className="text-loss text-[0.9375rem] mt-3">{t('events.teams.stale')}</p>}
                {teams.length > 0 && (
                  <>
                    <p className="text-[0.8125rem] faint mt-4 mb-2">{swapPick ? t('events.teams.swapSecond') : t('events.teams.swapHint')}</p>
                    <ol className="grid gap-2 sm:grid-cols-2">
                      {teams.map((team, i) => (
                        <li key={team.id} className="rounded-xl border border-line p-2">
                          <div className="flex items-center justify-between px-1 mb-1">
                            <span className="text-[0.8125rem] faint">{t('events.teams.team')} {i + 1}</span>
                            <span className="num text-sm">{Number(team.rating).toFixed(3)}</span>
                          </div>
                          {team.players.map((pl) => (
                            <button key={pl.user_id} onClick={() => handleSwapPick(pl.user_id)} disabled={actionLoading} aria-pressed={swapPick === pl.user_id}
                              className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left ${swapPick === pl.user_id ? 'bg-volt text-volt-ink' : 'hover:bg-court-tint'}`}>
                              <Avatar name={pl.name} size={28} you={pl.user_id === currentUser?.id} />
                              <span className="flex-1 truncate font-medium">{pl.name}</span>
                              <span className="num text-sm">{Number(pl.rating).toFixed(2)}</span>
                            </button>
                          ))}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>
            )}

            <section className="panel p-5 grid gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ev-status" className="label">{t('events.admin.eventStatus')}</label>
                <select id="ev-status" value={status} onChange={(e) => handleUpdateEventStatus(e.target.value)} disabled={actionLoading} className="field">
                  <option value="registration">{t('events.status.open')}</option>
                  <option value="registration_closed">{t('events.status.closed')}</option>
                  <option value="live" disabled={!event.bracket_data}>{t('events.status.live')}</option>
                  <option value="completed" disabled={!event.bracket_data?.champion}>{t('events.status.completed')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ev-cap" className="label">{t('events.create.max_players')}</label>
                <select id="ev-cap" value={event.max_players ? event.max_players.toString() : 'Open'} onChange={(e) => handleQuickCapacity(e.target.value)} disabled={actionLoading || isBracketGenerated} className="field">
                  {['4', '8', '16', '32', '64'].map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value="Open">{t('events.create.openPlayers')}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ev-fee" className="label">{t('events.details.entryFee')}</label>
                {isEditingFee ? (
                  <div className="flex gap-2">
                    <input id="ev-fee" autoFocus type="text" value={newFee} onChange={(e) => setNewFee(e.target.value)} className="field" />
                    <button onClick={handleUpdateFee} className="btn btn-win !px-3" aria-label={t('events.admin.saveFee')}><Check size={18} /></button>
                    <button onClick={() => setIsEditingFee(false)} className="btn btn-outline !px-3" aria-label={t('logMatch.cancel')}><X size={18} /></button>
                  </div>
                ) : (
                  <button id="ev-fee" onClick={() => { setIsEditingFee(true); setNewFee(event.entry_fee || ''); }} className="field text-left flex items-center justify-between">
                    <span className="truncate">{event.entry_fee || t('events.create.free')}</span><span className="text-court text-sm font-semibold">{t('events.admin.editFee')}</span>
                  </button>
                )}
              </div>
            </section>

            <section>
              <div className="w-full sm:w-96 mb-3">
                <Segmented label={t('events.tabs.participants')} value={adminView} onChange={setAdminView} options={[
                  { value: 'pending', label: `${t('events.admin.pending')} ${pendingParticipants.length}` },
                  { value: 'waitlist', label: `${t('events.admin.waitlist')} ${waitlistParticipants.length}` },
                  { value: 'roster', label: `${t('events.admin.approved')} ${approvedParticipants.length}` },
                ]} />
              </div>
              {adminView === 'pending' && (pendingParticipants.length === 0 ? <Empty>{t('events.details.no_pending')}</Empty>
                : <ul className="panel rows">{pendingParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="pending" />)}</ul>)}
              {adminView === 'waitlist' && (waitlistParticipants.length === 0 ? <Empty>{t('events.admin.waitlistEmpty')}</Empty>
                : <ol className="panel rows">{waitlistParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="waitlist" />)}</ol>)}
              {adminView === 'roster' && (approvedParticipants.length === 0 ? <Empty>{t('events.admin.rosterEmpty')}</Empty>
                : <ol className="panel rows">{approvedParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="roster" />)}</ol>)}
            </section>
          </div>
        )}
      </div>

      {dialogs}

      <Sheet open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} title={t('guest.title')}>
        <p className="muted mb-5">{t('guest.eventsBody')}</p>
        <button onClick={() => router.push('/login')} className="btn btn-primary w-full">{t('guest.cta')}</button>
        <button onClick={() => setShowGuestPrompt(false)} className="btn btn-quiet w-full mt-2">{t('guest.later')}</button>
      </Sheet>
    </Page>
  );
}
