"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Check, X, Users, Clock, Crown, LogOut, RotateCcw, AlertTriangle, ChevronLeft } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useLanguage } from "../../../context/LanguageContext";
import { Page, Loading, Empty, Avatar, Segmented, ScoreStepper, Sheet, displayName } from "../../../components/ui";
import { normalizeStatus, statusLabel, statusTag, isDoublesEvent } from "../../../lib/eventStatus";
import { locale } from "../../../lib/matchHistory";

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
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
      userProfile = prof;
    }

    const { data: eventData, error: eventErr } = await supabase.from('events').select('*').eq('id', id).single();
    if (eventErr || !eventData) throw new Error("Event not found");

    if (eventData.host_id) {
       const { data: hostData } = await supabase.from('profiles').select('email').eq('id', eventData.host_id).maybeSingle();
       eventData.host_email = hostData?.email || 'Admin';
    }

    const { data: partData } = await supabase
      .from('event_participants')
      .select('*, profiles!inner(email, rating, profile_hash)')
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
  const [viewRound, setViewRound] = useState(1);
  const [initializedRound, setInitializedRound] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  // Jump to the current active round on initial load
  useEffect(() => {
    if (event?.bracket_data?.current_round && !initializedRound) {
      setViewRound(event.bracket_data.current_round);
      setInitializedRound(true);
    }
  }, [event, initializedRound]);

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

  const handleClearBracket = async () => {
    if (!confirm(t('events.alerts.warningReset'))) return;
    setActionLoading(true);
    const { error } = await supabase.from('events').update({ bracket_data: null, status: 'registration_closed' }).eq('id', id); 
    if (error) alert(error.message);
    else {
      await mutate();
      setViewRound(1);
      setMatchScores({});
    }
    setActionLoading(false);
  };

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
    if (error && error.code !== '23505') alert(`Database Error: ${error.message}`);
    
    await mutate();
    setActionLoading(false);
  };

  const handleLeaveEvent = async () => {
    if (event?.bracket_data) return alert(t('events.alerts.bracketGeneratedWithdraw'));
    if (!confirm(t('events.alerts.confirmWithdraw'))) return;
    setActionLoading(true);
    const { error } = await supabase.from('event_participants').delete().eq('event_id', id).eq('user_id', currentUser.id);
    if (error) alert(`Error: ${error.message}`);
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
    if (newStatus === 'live' && !event.bracket_data) return alert(t('events.alerts.generateBeforeLive'));
    if (newStatus === 'registration' && event.bracket_data) return alert(t('events.alerts.resetBeforeReg'));
    
    setActionLoading(true);
    const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', id);
    if (!error) await mutate();
    setActionLoading(false);
  };

  const getSeedingArray = (size) => {
    if (size === 2) return [1, 2];
    let pls = [1, 2];
    for (let i = 1; i < Math.log2(size); i++) {
      let out = [];
      let length = pls.length * 2 + 1;
      pls.forEach(d => { out.push(d); out.push(length - d); });
      pls = out;
    }
    return pls;
  };

  const handleGenerateBracket = async () => {
    if (event.status !== 'registration_closed') return alert(t('events.alerts.statusMustBeClosed'));
    
    const approved = participants.filter(p => p.status === 'approved');
    if (approved.length < 2) return alert(t('events.alerts.notEnoughPlayers'));

    setActionLoading(true);
    
    const seededPlayers = [...approved].sort((a, b) => (b.profiles?.rating || 0) - (a.profiles?.rating || 0))
      .map(p => ({ user_id: p.user_id, email: p.profiles?.email, rating: p.profiles?.rating }));

    const numPlayers = seededPlayers.length;
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers || 1)));
    const totalRounds = Math.log2(bracketSize) || 1;
    const seedingOrder = getSeedingArray(bracketSize);
    
    const rounds = {};
    let currentMatchCount = bracketSize / 2;
    
    for (let r = 1; r <= totalRounds; r++) {
      rounds[r] = [];
      for (let m = 0; m < currentMatchCount; m++) {
        rounds[r].push({
          match_id: `r${r}_m${m + 1}`, player1: null, player2: null, score1: 0, score2: 0, status: 'pending', winner_id: null, is_bye: false
        });
      }
      currentMatchCount /= 2;
    }
    
    for (let i = 0; i < bracketSize; i += 2) {
      const s1 = seedingOrder[i];
      const s2 = seedingOrder[i + 1];
      
      const p1 = s1 <= numPlayers ? seededPlayers[s1 - 1] : null;
      const p2 = s2 <= numPlayers ? seededPlayers[s2 - 1] : null;
      
      const isBye = !p1 || !p2;
      const winner = isBye ? (p1 || p2) : null;
      
      const mIdx = i / 2;
      rounds[1][mIdx].player1 = p1;
      rounds[1][mIdx].player2 = p2;
      rounds[1][mIdx].is_bye = isBye;
      rounds[1][mIdx].status = isBye ? 'completed' : 'pending';
      rounds[1][mIdx].winner_id = winner ? winner.user_id : null;
      
      if (isBye && totalRounds > 1) {
        const nextMatchIdx = Math.floor(mIdx / 2);
        const isPlayer1 = mIdx % 2 === 0;
        if (isPlayer1) rounds[2][nextMatchIdx].player1 = winner;
        else rounds[2][nextMatchIdx].player2 = winner;
      }
    }

    let current_round = 1;
    const allR1Completed = rounds[1].every(m => m.status === 'completed');
    if (allR1Completed && totalRounds > 1) current_round = 2; 

    const bracketData = { rounds, current_round, champion: null };
    
    const { error } = await supabase.from('events').update({ bracket_data: bracketData, status: 'live' }).eq('id', id);
    
    if (error) {
        alert(`Bracket Error: ${error.message}`);
    } else {
        const freshData = await mutate();
        if (freshData?.event?.bracket_data?.current_round) setViewRound(freshData.event.bracket_data.current_round);
    }
    setActionLoading(false);
  };

  const handleSaveScore = async (matchId) => {
    const localS1 = matchScores[matchId]?.s1;
    const localS2 = matchScores[matchId]?.s2;

    let updatedBracket = JSON.parse(JSON.stringify(event.bracket_data));
    const currRound = updatedBracket.current_round;
    const matchIndex = updatedBracket.rounds[currRound].findIndex(m => m.match_id === matchId);
    if (matchIndex === -1) return;
    
    const match = updatedBracket.rounds[currRound][matchIndex];
    
    const rawS1 = localS1 !== undefined ? localS1 : match.score1;
    const rawS2 = localS2 !== undefined ? localS2 : match.score2;

    if (rawS1 === '' || rawS2 === '') return alert(t('events.alerts.enterBothScores'));

    const s1 = parseInt(rawS1 || 0);
    const s2 = parseInt(rawS2 || 0);
    const maxScore = Math.max(s1, s2);
    const diffScore = Math.abs(s1 - s2);
    
    if (s1 === s2) return alert(t('events.alerts.no_tie'));
    if (s1 < 0 || s2 < 0) return alert(t('events.alerts.no_negative'));
    if (s1 > 50 || s2 > 50) return alert(t('events.alerts.max_score'));
    // Same rule as the rating engine: games to 11, 15 or 21, win by 2 (overtime ends at exactly +2).
    const validGame = ([11, 15, 21].includes(maxScore) && diffScore >= 2) || (maxScore > 11 && diffScore === 2);
    if (!validGame) return alert(t('alerts.invalidPickleballScore'));

    setActionLoading(true);

    const isFirstSave = match.status === 'pending';
    
    match.score1 = s1;
    match.score2 = s2;
    match.status = 'completed';
    match.winner_id = s1 > s2 ? match.player1.user_id : match.player2.user_id;

    if (isFirstSave) {
        try {
            const { data, error } = await supabase.functions.invoke('submit-match', {
                body: {
                  context: 'tournament',
                  eventId: id,
                  scoreA: s1,
                  scoreB: s2,
                  playerAId: match.player1.user_id,
                  partnerId: null, 
                  opp1Id: match.player2.user_id,
                  opp2Id: null,
                },
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            if (data?.newRatingA) match.player1.rating = data.newRatingA;
            if (data?.newRatingB) match.player2.rating = data.newRatingB;

        } catch (err) {
            console.error("DUPR Logging Error:", err);
            alert("Warning: Match saved to bracket, but DUPR update failed: " + err.message);
        }
    } else {
        alert(t('events.alerts.scoreUpdatedNoDupr'));
    }

    const { error } = await supabase.from('events').update({ bracket_data: updatedBracket }).eq('id', id);
    if (error) alert(`Error: ${error.message}`);
    else await mutate();
    
    setActionLoading(false);
  };

  const handleRollbackRound = async () => {
    if (!event.bracket_data) return;
    let updatedBracket = JSON.parse(JSON.stringify(event.bracket_data));
    const currRound = updatedBracket.current_round;
    
    if (currRound <= 1) return alert(t('events.alerts.cannotRollback'));
    if (!confirm(t('events.alerts.confirmRollback') + ` Round ${currRound - 1}?`)) return;
    
    setActionLoading(true);

    updatedBracket.champion = null;
    
    updatedBracket.rounds[currRound].forEach(match => {
        match.player1 = null;
        match.player2 = null;
        match.score1 = 0;
        match.score2 = 0;
        match.status = 'pending';
        match.winner_id = null;
    });

    const previousRoundNum = currRound - 1;
    updatedBracket.current_round = previousRoundNum;

    const { error } = await supabase.from('events').update({ bracket_data: updatedBracket, status: 'live' }).eq('id', id);
    
    if (!error) {
        await mutate();
        setViewRound(previousRoundNum);
    } else alert(`Error: ${error.message}`);
    
    setActionLoading(false);
  };

  const handleAdvanceRound = async () => {
    setActionLoading(true);
    let updatedBracket = JSON.parse(JSON.stringify(event.bracket_data));
    const currRound = updatedBracket.current_round;
    const totalRounds = Object.keys(updatedBracket.rounds).length;

    if (currRound === totalRounds) {
        if (!confirm(t('events.alerts.confirmCrownChampion'))) { setActionLoading(false); return; }
        const finalMatch = updatedBracket.rounds[currRound][0];
        updatedBracket.champion = finalMatch.winner_id;
        const { error } = await supabase.from('events').update({ status: 'completed', bracket_data: updatedBracket }).eq('id', id);
        if (!error) await mutate();
    } else {
        if (!confirm(t('events.alerts.confirmLockRound'))) { setActionLoading(false); return; }
        const nextRoundNum = currRound + 1;
        const prevMatches = updatedBracket.rounds[currRound];

        for (let i = 0; i < prevMatches.length; i += 2) {
          const m1 = prevMatches[i];
          const m2 = prevMatches[i+1];
          const p1 = m1.winner_id === m1.player1?.user_id ? m1.player1 : m1.player2;
          const p2 = m2.winner_id === m2.player1?.user_id ? m2.player1 : m2.player2;

          const nextMatchIdx = i / 2;
          updatedBracket.rounds[nextRoundNum][nextMatchIdx].player1 = p1;
          updatedBracket.rounds[nextRoundNum][nextMatchIdx].player2 = p2;
        }

        updatedBracket.current_round = nextRoundNum;
        const { error } = await supabase.from('events').update({ bracket_data: updatedBracket }).eq('id', id);
        if (!error) {
            await mutate();
            setViewRound(nextRoundNum);
        }
    }
    setActionLoading(false);
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
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const ParticipantRow = ({ p, idx, viewType }) => {
    const lockRoster = actionLoading || isBracketGenerated;
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3">
        {(viewType === 'public' || viewType === 'roster' || viewType === 'waitlist') && <span className="num w-7 text-center faint">{idx + 1}</span>}
        <Avatar email={p.profiles?.email} you={p.user_id === currentUser?.id} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{p.profiles?.email ? displayName(p.profiles.email) : t('events.details.unknownUser')}</p>
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
            [t('events.details.hostedBy'), event.host_email ? displayName(event.host_email) : t('common.guest')],
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
            <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} aria-pressed={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 whitespace-nowrap">
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
                      {displayName(approvedParticipants.find(p => p.user_id === event.bracket_data.champion)?.profiles?.email, t('common.guest'))}
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
                    const won = match.winner_id && match.winner_id === player?.user_id;
                    return (
                      <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl ${won ? 'bg-win-tint' : ''}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar email={player?.email} size={32} you={player?.user_id === currentUser?.id} />
                          <span className={`truncate ${won ? 'font-bold' : 'font-medium'} ${player ? '' : 'faint'}`}>{player?.email ? displayName(player.email) : fallback}</span>
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
                  </ul>
                  <button onClick={handleGenerateBracket} disabled={actionLoading || status !== 'registration_closed' || approvedParticipants.length < 2} className="btn btn-primary w-full">
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

      <Sheet open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} title={t('guest.title')}>
        <p className="muted mb-5">{t('guest.eventsBody')}</p>
        <button onClick={() => router.push('/login')} className="btn btn-primary w-full">{t('guest.cta')}</button>
        <button onClick={() => setShowGuestPrompt(false)} className="btn btn-quiet w-full mt-2">{t('guest.later')}</button>
      </Sheet>
    </Page>
  );
}
