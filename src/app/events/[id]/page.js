"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "../../../context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Users, Activity, Check, X, Trophy, DollarSign, UserCheck, ChevronDown, LogOut, Clock, Crown, ShieldAlert, RotateCcw, AlertTriangle } from "lucide-react";
import useSWR from "swr";

const getInitials = (email) => email ? email.substring(0, 2).toUpperCase() : '?';

export default function EventDetails() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  
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

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-bold text-zinc-500 bg-[#050507]">
      <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
    </div>
  );

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
    if (maxScore < 11) return alert(t('events.alerts.min_11'));
    if (diffScore < 2) return alert(t('events.alerts.win_by_2'));
    if (maxScore > 11 && diffScore > 2) return alert(t('events.alerts.strict_11'));

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
                  isLive: false,
                  lobbyPin: null,
                  matchType: event.format === 'doubles' ? '2v2' : '1v1',
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
    const playersInRound = Math.pow(2, totalRounds - roundNum + 1);
    return `${t('events.bracket.roundOf')} ${playersInRound}`;
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'live': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'registration_closed': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'completed': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getFormatDisplayStatus = (status) => {
    const s = status?.toLowerCase();
    if (s === 'live') return t('events.status.live');
    if (s === 'registration_closed') return t('events.status.closed');
    if (s === 'completed') return t('events.status.completed');
    return t('events.status.open');
  };

  const ParticipantRow = ({ p, idx, viewType }) => {
    const isFull = event.max_players && participants.filter(part => part.status === 'approved').length >= event.max_players;
    const isBracketGenerated = !!event?.bracket_data;
    const disableRosterActions = actionLoading || isBracketGenerated;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white/3 rounded-2xl border border-white/5 gap-4 group hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center font-black text-zinc-400 border border-white/10">{getInitials(p.profiles?.email)}</div>
          <div>
            <p className="font-bold text-white text-sm">{p.profiles?.email || t('events.details.unknownUser')}</p>
            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">{viewType === 'roster' || viewType === 'public' ? `${t('events.details.seed')} #${idx + 1}` : viewType === 'waitlist' ? `${t('events.details.position')} #${idx + 1}` : 'DUPR'}: {Number(p.profiles?.rating || 0).toFixed(3)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto transition-opacity">
          {viewType === 'pending' && (
            <>
              <button onClick={() => handleUpdateStatus(p.id, 'approved')} disabled={disableRosterActions || isFull} title={isBracketGenerated ? t('events.alerts.bracketExists') : ""} className={`flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${disableRosterActions || isFull ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}><Check className="w-4 h-4" /> {t('events.buttons.approve')}</button>
              <button onClick={() => handleUpdateStatus(p.id, 'rejected')} disabled={disableRosterActions} title={isBracketGenerated ? t('events.alerts.bracketExists') : ""} className={`flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${disableRosterActions ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}><X className="w-4 h-4" /> {t('events.buttons.reject')}</button>
            </>
          )}
          {viewType === 'waitlist' && (
            <>
              <button onClick={() => handleUpdateStatus(p.id, 'approved')} disabled={disableRosterActions || isFull} title={isBracketGenerated ? t('events.alerts.bracketExists') : ""} className={`flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${disableRosterActions || isFull ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'}`}><Check className="w-4 h-4" /> {t('events.buttons.promote')}</button>
              <button onClick={() => handleUpdateStatus(p.id, 'rejected')} disabled={disableRosterActions} title={isBracketGenerated ? t('events.alerts.bracketExists') : ""} className={`flex-1 sm:flex-none h-10 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition ${disableRosterActions ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}><X className="w-4 h-4" /> {t('events.buttons.remove')}</button>
            </>
          )}
          {viewType === 'roster' && (
            <>
              <button onClick={() => toggleParticipantState(p.id, 'has_paid', p.has_paid)} disabled={actionLoading} className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all shadow-inner border ${p.has_paid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-green-400'}`}><DollarSign className="w-4 h-4" /></button>
              <button onClick={() => toggleParticipantState(p.id, 'checked_in', p.checked_in)} disabled={actionLoading} className={`h-10 w-10 flex items-center justify-center rounded-xl transition-all shadow-inner border ${p.checked_in ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 border-white/10 text-zinc-500 hover:text-blue-400'}`}><UserCheck className="w-4 h-4" /></button>
              {p.user_id !== event.host_id && <button onClick={() => handleUpdateStatus(p.id, 'rejected')} disabled={disableRosterActions} title={isBracketGenerated ? t('events.alerts.cannotModifyRoster') : ""} className={`h-10 px-4 rounded-xl font-bold text-xs transition-all border ml-1 ${disableRosterActions ? 'bg-zinc-800 text-zinc-500 border-transparent cursor-not-allowed' : 'bg-red-500/10 text-red-400 border-red-500/10 hover:bg-red-500/20'}`}>{t('events.buttons.remove')}</button>}
            </>
          )}
          {viewType === 'public' && <span className="bg-orange-500/10 text-orange-400 font-black px-2 py-1 rounded-lg text-[10px]">{Number(p.profiles?.rating || 0).toFixed(3)}</span>}
        </div>
      </div>
    );
  };

  const isEventAdmin = currentUser?.id === event?.host_id || userProfile?.role === 'admin';
  const myParticipantRecord = participants.find(p => p.user_id === currentUser?.id);
  const hasJoined = !!myParticipantRecord;
  
  const approvedParticipants = participants.filter(p => p.status === 'approved');
  const pendingParticipants = participants.filter(p => p.status === 'pending');
  const waitlistParticipants = participants.filter(p => p.status === 'waitlist');
  const isFull = event.max_players && approvedParticipants.length >= event.max_players;
  const normalizedEventStatus = event?.status === 'upcoming' ? 'registration' : event?.status;

  let displayRegistered = approvedParticipants.length;
  if (event?.bracket_data) {
      let c = 0;
      event.bracket_data.rounds[1].forEach(m => { if(m.player1) c++; if(m.player2) c++; });
      displayRegistered = c;
  }

  const totalRounds = event?.bracket_data ? Object.keys(event.bracket_data.rounds).length : 0;
  const isBracketVisibleToUser = isEventAdmin || event?.status === 'live' || event?.status === 'completed';
  const visibleRounds = event?.bracket_data ? Object.keys(event.bracket_data.rounds).filter(r => Number(r) <= event.bracket_data.current_round) : [];

  return (
    <main className="min-h-dvh px-4 pb-24 pt-20 md:pt-8 md:px-8 w-full bg-[#050507]">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
        
        <div className="glass-panel p-6 sm:p-10 rounded-4xl relative overflow-hidden shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
          <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
            <div className="flex-1 space-y-5 w-full">
              <div className="flex flex-wrap gap-2">
                <span className={`border text-[10px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-widest whitespace-nowrap truncate max-w-37.5 ${getStatusColor(normalizedEventStatus)}`}>
                  {getFormatDisplayStatus(normalizedEventStatus)}
                </span>
                <span className="bg-white/5 border border-white/10 text-zinc-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wider whitespace-nowrap">
                  {event.event_type === 'tournament' ? t('events.status.tournament') : t('events.status.open_play')}
                </span>
                <span className="bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wider whitespace-nowrap">
                  {event.entry_fee ? event.entry_fee : t('events.create.free')}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tighter leading-[1.1] max-w-2xl">
                {event.title}
              </h1>

              <div className="flex flex-wrap items-center gap-5">
                
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <Crown className="w-4 h-4 text-orange-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{t('events.details.hostedBy')}</span>
                    <span className="text-xs font-bold truncate max-w-30">{event.host_email?.split('@')[0] || t('common.guest')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-zinc-300">
                  <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{t('events.create.begin_date')}</span>
                    <span className="text-xs font-bold truncate">{new Date(event.begin_date).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <MapPin className="w-4 h-4 text-orange-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{t('events.create.location')}</span>
                    <span className="text-xs font-bold truncate">{event.location}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5 text-zinc-300">
                  <Users className="w-4 h-4 text-orange-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{t('events.details.registered')}</span>
                    <span className="text-xs font-bold truncate">{displayRegistered !== undefined ? displayRegistered : 0} / {event.max_players || '∞'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-auto shrink-0 flex flex-col gap-3">
              {!hasJoined ? (
                <button 
                  onClick={requireAuth(handleJoin)}
                  disabled={actionLoading || normalizedEventStatus === 'registration_closed' || normalizedEventStatus === 'live' || normalizedEventStatus === 'completed'}
                  className={`w-full lg:w-auto text-white font-bold text-base h-12 px-8 rounded-xl active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-[0_8px_20px_rgba(0,0,0,0.3)] flex justify-center items-center ${isFull ? 'bg-zinc-600 hover:bg-zinc-500' : 'bg-orange-600 hover:bg-orange-500 shadow-[0_8px_20px_rgba(234,88,12,0.3)]'}`}
                >
                  {actionLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 
                    (normalizedEventStatus === 'registration_closed' || normalizedEventStatus === 'live' || normalizedEventStatus === 'completed' ? t('events.buttons.registration_closed') : (isFull ? t('events.buttons.joinWaitlist') : t('events.buttons.join_event')))}
                </button>
              ) : (
                <>
                  <div className="bg-white/5 border border-white/10 px-6 py-3 rounded-xl text-center flex flex-col items-center justify-center gap-1">
                    {myParticipantRecord.status === 'approved' && <span className="text-xs font-bold text-green-400 flex items-center gap-1.5"><Check className="w-3.5 h-3.5"/> {t('events.buttons.approved')}</span>}
                    {myParticipantRecord.status === 'pending' && <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {t('events.buttons.pending_approval')}</span>}
                    {myParticipantRecord.status === 'waitlist' && <span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5"/> {t('events.buttons.onWaitlist')}</span>}
                    {myParticipantRecord.status === 'approved' && event.entry_fee && <span className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">{t('events.details.payHostDirectly')}</span>}
                  </div>
                  {normalizedEventStatus === 'registration' && currentUser?.id !== event?.host_id && !event.bracket_data && (
                     <button onClick={handleLeaveEvent} disabled={actionLoading} className="text-red-400 text-xs font-bold hover:text-red-300 transition flex items-center justify-center gap-1 mt-1">
                       {actionLoading ? "..." : <><LogOut className="w-3 h-3" /> {t('events.buttons.withdraw')}</>}
                     </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="w-full overflow-x-auto hide-scrollbar">
          <div className="flex glass-card rounded-xl p-1 border border-white/5 bg-black/40 w-full min-w-max sm:min-w-0">
            {[
              { id: 'overview', label: t('events.tabs.overview') },
              { id: 'participants', label: t('events.tabs.participants') },
              { id: 'bracket', label: t('events.tabs.bracket') },
              ...(isEventAdmin ? [{ id: 'admin', label: t('events.tabs.admin') }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm transition-all whitespace-nowrap ${
                  activeTab === tab.id ? 'text-white font-bold' : 'text-zinc-500 font-bold hover:text-zinc-300'
                }`}
              >
                {activeTab === tab.id && <motion.div layoutId="eventActiveTab" className="absolute inset-0 bg-white/10 rounded-lg shadow-inner border border-white/10" transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
                <span className="relative z-10 tracking-wide uppercase text-[10px] sm:text-xs">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel p-5 sm:p-8 rounded-3xl min-h-75">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white tracking-tight">{t('events.details.welcome')}</h3>
                    <p className="text-zinc-400 leading-relaxed text-sm">
                      {t('events.details.eventDesc')} {event.format}. {t('events.details.ensureDupr')} {event.min_dupr} - {event.max_dupr}.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { label: t('events.details.entryFee'), value: event.entry_fee || t('events.create.free') },
                      { label: t('events.create.format'), value: event.format },
                      { label: t('events.create.max_players'), value: event.max_players || 'Open' },
                      { label: t('events.create.min_dupr'), value: Number(event.min_dupr).toFixed(3) },
                      { label: t('events.create.max_dupr'), value: Number(event.max_dupr).toFixed(3) },
                    ].map((item, i) => (
                      <div key={i} className="bg-white/2 border border-white/5 p-3 rounded-xl">
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="font-bold text-white capitalize text-sm">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'participants' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {approvedParticipants.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-zinc-500 italic border border-dashed border-white/10 rounded-2xl">{t('events.details.no_players')}</div>
                  ) : (
                    approvedParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="public" />)
                  )}
                </div>
              )}

              {activeTab === 'bracket' && (
                <div className="w-full flex flex-col">
                  {!event.bracket_data || !isBracketVisibleToUser ? (
                    <div className="py-16 text-center space-y-4">
                      <Trophy className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                      <p className="text-zinc-500 font-medium text-sm">
                          {!event.bracket_data 
                              ? t('events.bracket.notGenerated') 
                              : t('events.bracket.hidden')}
                      </p>
                    </div>
                  ) : (
                    <div className="w-full">
                      {event.bracket_data.champion && (
                        <div className="py-10 text-center bg-orange-500/10 border border-orange-500/20 rounded-2xl mb-6 shadow-inner">
                          <Crown className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tighter">{t('events.bracket.champion')}</h2>
                          <p className="text-lg sm:text-xl text-orange-400 font-bold mt-1">
                            {approvedParticipants.find(p => p.user_id === event.bracket_data.champion)?.profiles?.email?.split('@')[0] || t('common.guest')}
                          </p>
                        </div>
                      )}

                      <div className="w-full overflow-x-auto hide-scrollbar mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <div className="flex gap-2 min-w-max pb-2">
                          {(isEventAdmin ? Object.keys(event.bracket_data.rounds) : visibleRounds).map((r) => {
                            const roundNum = Number(r);
                            const isActive = viewRound === roundNum;
                            return (
                              <button
                                key={roundNum}
                                onClick={() => setViewRound(roundNum)}
                                className={`px-4 h-10 rounded-lg text-xs font-bold transition-all whitespace-nowrap border ${
                                  isActive ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'bg-black/40 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {getRoundName(roundNum, totalRounds)}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {event.bracket_data.rounds[viewRound]?.map((match) => (
                          <div key={match.match_id} className={`bg-black/60 border ${viewRound === event.bracket_data.current_round ? 'border-orange-500/20' : 'border-white/10'} rounded-2xl p-4 shadow-inner relative overflow-hidden group`}>
                            
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{t('events.bracket.match')} {match.match_id.split('_m')[1]}</span>
                              {match.is_bye ? (
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">{t('events.bracket.autoAdvance')}</span>
                              ) : match.status === 'completed' ? (
                                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded">{t('events.status.completed')}</span>
                              ) : null}
                            </div>

                            <div className="space-y-2">
                              <div className={`flex justify-between items-center p-2.5 rounded-xl border ${match.winner_id === match.player1?.user_id ? 'bg-orange-500/10 border-orange-500/30 shadow-[inset_0_0_10px_rgba(234,88,12,0.1)]' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-400">{getInitials(match.player1?.email)}</div>
                                  <span className={`font-bold text-sm truncate max-w-28 sm:max-w-32 ${match.winner_id === match.player1?.user_id ? 'text-orange-400' : 'text-zinc-300'}`}>{match.player1?.email?.split('@')[0] || t('events.bracket.tbd')}</span>
                                </div>
                                <span className="font-black text-base text-white ml-2">{match.is_bye ? '-' : match.score1}</span>
                              </div>
                              
                              <div className="flex justify-center -my-1.5 relative z-10"><span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest bg-[#050507] px-1.5 rounded-full border border-white/5">VS</span></div>

                              <div className={`flex justify-between items-center p-2.5 rounded-xl border ${match.winner_id === match.player2?.user_id ? 'bg-orange-500/10 border-orange-500/30 shadow-[inset_0_0_10px_rgba(234,88,12,0.1)]' : 'bg-white/5 border-white/5'}`}>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-black border border-white/10 flex items-center justify-center text-[10px] font-black text-zinc-400">{getInitials(match.player2?.email)}</div>
                                  <span className={`font-bold text-sm truncate max-w-28 sm:max-w-32 ${match.winner_id === match.player2?.user_id ? 'text-orange-400' : 'text-zinc-300'}`}>{match.player2?.email?.split('@')[0] || t('events.bracket.tbdBye')}</span>
                                </div>
                                <span className="font-black text-base text-white ml-2">{match.is_bye ? '-' : match.score2}</span>
                              </div>
                            </div>

                            {isEventAdmin && !match.is_bye && match.player1 && match.player2 && viewRound === event.bracket_data.current_round && (
                              <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                  <input 
                                    type="number" 
                                    min="0"
                                    pattern="\d*"
                                    placeholder={t('events.bracket.p1Score')} 
                                    value={matchScores[match.match_id]?.s1 !== undefined ? matchScores[match.match_id].s1 : (match.status === 'completed' ? match.score1 : '')}
                                    onChange={(e) => updateLocalScore(match.match_id, 's1', e.target.value)} 
                                    className="w-full h-10 bg-black/60 border border-white/10 rounded-lg px-3 text-white outline-none text-sm font-bold text-center focus:border-orange-500/50 transition-colors" 
                                  />
                                  <span className="text-zinc-600 font-black">-</span>
                                  <input 
                                    type="number" 
                                    min="0"
                                    pattern="\d*"
                                    placeholder={t('events.bracket.p2Score')} 
                                    value={matchScores[match.match_id]?.s2 !== undefined ? matchScores[match.match_id].s2 : (match.status === 'completed' ? match.score2 : '')}
                                    onChange={(e) => updateLocalScore(match.match_id, 's2', e.target.value)} 
                                    className="w-full h-10 bg-black/60 border border-white/10 rounded-lg px-3 text-white outline-none text-sm font-bold text-center focus:border-orange-500/50 transition-colors" 
                                  />
                                </div>
                                <button onClick={() => handleSaveScore(match.match_id)} disabled={actionLoading} className="w-full h-10 bg-zinc-800 text-zinc-300 border border-white/10 rounded-lg text-xs font-bold hover:bg-zinc-700 hover:text-white transition active:scale-95 disabled:opacity-50">
                                  {match.status === 'completed' ? t('events.bracket.updateScore') : t('events.bracket.saveScore')}
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {isEventAdmin && viewRound === event.bracket_data.current_round && event.bracket_data.rounds[viewRound].every(m => m.status === 'completed') && !event.bracket_data.champion && (
                          <div className="mt-6 bg-purple-500/10 border border-purple-500/20 p-5 rounded-2xl text-center shadow-inner">
                              <ShieldAlert className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                              <h4 className="text-lg font-black text-purple-400 mb-1">{t('events.bracket.roundComplete')}</h4>
                              <p className="text-xs text-zinc-400 mb-4 max-w-xs mx-auto">{t('events.bracket.approveNextRoundDesc')}</p>
                              <button onClick={handleAdvanceRound} disabled={actionLoading} className="h-12 bg-purple-600 text-white font-bold px-8 rounded-xl text-sm hover:bg-purple-500 transition shadow-[0_0_15px_rgba(147,51,234,0.3)] active:scale-95 disabled:opacity-50">
                                  {viewRound === totalRounds ? t('events.bracket.finalizeTournament') : t('events.bracket.approveRound')}
                              </button>
                          </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'admin' && (
                <div className="space-y-5">
                  
                  <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/5 bg-linear-to-b from-purple-500/5 to-transparent relative overflow-hidden">
                     <h3 className="text-base font-black text-white mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-purple-400" /> {t('events.admin.tournamentEngine')}</h3>
                     <p className="text-zinc-400 text-xs mb-5">{t('events.admin.engineDesc')}</p>

                     {!event.bracket_data ? (
                       <div className="space-y-4">
                          <button
                            onClick={handleGenerateBracket}
                            disabled={actionLoading || normalizedEventStatus !== 'registration_closed' || approvedParticipants.length < 2}
                            className="w-full h-12 bg-purple-600 text-white font-bold text-base rounded-xl hover:bg-purple-500 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 shadow-[0_8px_20px_rgba(147,51,234,0.2)]"
                          >
                            {actionLoading ? t('events.buttons.processing') : t('events.admin.generateBracket')}
                          </button>
                          
                          <div className="flex flex-col gap-2 text-xs font-bold bg-black/40 p-3.5 rounded-xl border border-white/5">
                            <div className={`flex items-center gap-2 ${normalizedEventStatus === 'registration_closed' ? 'text-green-400' : 'text-orange-400'}`}>
                              {normalizedEventStatus === 'registration_closed' ? <Check className="w-3.5 h-3.5"/> : <X className="w-3.5 h-3.5"/>}
                              {t('events.admin.statusMustBeClosed')}
                            </div>
                            <div className={`flex items-center gap-2 ${approvedParticipants.length >= 2 ? 'text-green-400' : 'text-orange-400'}`}>
                              {approvedParticipants.length >= 2 ? <Check className="w-3.5 h-3.5"/> : <X className="w-3.5 h-3.5"/>}
                              {t('events.admin.requiresPlayers')} ({approvedParticipants.length})
                            </div>
                          </div>
                       </div>
                     ) : (
                       <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center">
                          <ShieldAlert className="w-6 h-6 text-green-400 mx-auto mb-2" />
                          <h4 className="text-base font-black text-white mb-1">{t('events.admin.bracketIsLive')}</h4>
                          <p className="text-xs text-zinc-400 mb-5 max-w-sm mx-auto">{t('events.admin.bracketLiveDesc')}</p>
                          <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
                            {event.bracket_data.current_round > 1 && (
                              <button onClick={handleRollbackRound} disabled={actionLoading} className="h-10 bg-orange-500/10 text-orange-400 border border-orange-500/20 px-5 rounded-lg text-xs font-bold hover:bg-orange-500/20 transition active:scale-95 flex items-center justify-center gap-1.5">
                                 <RotateCcw className="w-3.5 h-3.5" /> {t('events.admin.rollback')}
                              </button>
                            )}
                            <button onClick={handleClearBracket} disabled={actionLoading} className="h-10 bg-red-500/10 text-red-400 border border-red-500/20 px-5 rounded-lg text-xs font-bold hover:bg-red-500/20 transition active:scale-95 flex items-center justify-center gap-1.5">
                               <AlertTriangle className="w-3.5 h-3.5" /> {t('events.admin.wipeReset')}
                            </button>
                          </div>
                       </div>
                     )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] font-black uppercase text-zinc-500 bg-white/5 px-2 py-1 rounded">{t('events.admin.eventStatus')}</span>
                      </div>
                      <div className="relative">
                        <select value={normalizedEventStatus} onChange={(e) => handleUpdateEventStatus(e.target.value)} disabled={actionLoading} className="w-full h-12 bg-black/50 border border-white/10 rounded-xl px-3 text-white outline-none text-sm font-bold appearance-none cursor-pointer focus:border-orange-500/50 transition-colors">
                          <option value="registration">{t('events.status.open')} (Reg)</option>
                          <option value="registration_closed">{t('events.status.closed')} (Reg)</option>
                          <option value="live" disabled={!event.bracket_data}>{t('events.status.live')}</option>
                          <option value="completed" disabled={!event.bracket_data?.champion}>{t('events.status.completed')}</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] font-black uppercase text-zinc-500 bg-white/5 px-2 py-1 rounded">{t('events.create.max_players')}</span>
                      </div>
                      <div className="relative">
                        <select value={event.max_players ? event.max_players.toString() : 'Open'} onChange={(e) => handleQuickCapacity(e.target.value)} disabled={actionLoading || event.bracket_data} className="w-full h-12 bg-black/50 border border-white/10 rounded-xl px-3 text-white outline-none text-sm font-bold appearance-none cursor-pointer focus:border-blue-500/50 transition-colors disabled:opacity-50">
                          <option value="4">4 Players</option><option value="8">8 Players</option><option value="16">16 Players</option><option value="32">32 Players</option><option value="64">64 Players</option><option value="Open">Open</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>

                    <div className="bg-[#0a0a0c] border border-white/5 p-4 rounded-2xl flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[9px] font-black uppercase text-zinc-500 bg-white/5 px-2 py-1 rounded">{t('events.details.entryFee')}</span>
                      </div>
                      {isEditingFee ? (
                        <div className="flex items-center gap-1.5">
                          <input autoFocus type="text" value={newFee} onChange={(e)=>setNewFee(e.target.value)} className="w-full h-10 bg-black/50 border border-white/10 rounded-lg px-2.5 text-white outline-none text-sm font-bold" placeholder="$20" />
                          <button onClick={handleUpdateFee} className="w-10 h-10 flex items-center justify-center bg-green-600/20 text-green-400 rounded-lg"><Check className="w-4 h-4"/></button>
                          <button onClick={() => setIsEditingFee(false)} className="w-10 h-10 flex items-center justify-center bg-white/5 text-zinc-400 rounded-lg"><X className="w-4 h-4"/></button>
                        </div>
                      ) : (
                        <div>
                          <p className="text-xl font-black text-white truncate">{event.entry_fee || t('events.create.free')}</p>
                          <button onClick={() => { setIsEditingFee(true); setNewFee(event.entry_fee || ""); }} className="text-green-400 text-[10px] font-bold hover:text-green-300 mt-0.5 uppercase tracking-wider">{t('events.admin.editFee')}</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-6">
                    <div className="flex flex-wrap gap-4 mb-4">
                      <button onClick={() => setAdminView('pending')} className={`text-xs font-bold pb-1.5 transition-all ${adminView === 'pending' ? 'text-white border-b-2 border-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Pending ({pendingParticipants.length})</button>
                      <button onClick={() => setAdminView('waitlist')} className={`text-xs font-bold pb-1.5 transition-all ${adminView === 'waitlist' ? 'text-white border-b-2 border-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Waitlist ({waitlistParticipants.length})</button>
                      <button onClick={() => setAdminView('roster')} className={`text-xs font-bold pb-1.5 transition-all ${adminView === 'roster' ? 'text-white border-b-2 border-orange-500' : 'text-zinc-500 hover:text-zinc-300'}`}>Approved Roster ({approvedParticipants.length})</button>
                    </div>

                    <div className="space-y-2.5">
                      {adminView === 'pending' && (pendingParticipants.length === 0 ? <div className="p-6 text-center text-xs text-zinc-600 bg-black/20 rounded-2xl border border-white/5">{t('events.details.no_pending')}</div> : pendingParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="pending" />))}
                      {adminView === 'waitlist' && (waitlistParticipants.length === 0 ? <div className="p-6 text-center text-xs text-zinc-600 bg-black/20 rounded-2xl border border-white/5">{t('events.admin.waitlistEmpty')}</div> : waitlistParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="waitlist" />))}
                      {adminView === 'roster' && (approvedParticipants.length === 0 ? <div className="p-6 text-center text-xs text-zinc-600 bg-black/20 rounded-2xl border border-white/5">{t('events.admin.rosterEmpty')}</div> : approvedParticipants.map((p, idx) => <ParticipantRow key={p.id} p={p} idx={idx} viewType="roster" />))}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Guest Prompt Modal */}
      <AnimatePresence>
        {showGuestPrompt && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm touch-none" 
              onClick={() => setShowGuestPrompt(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm glass-panel p-6 rounded-4xl border border-white/10 bg-[#0a0a0c]/95 text-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4 border border-orange-500/20">
                <Trophy className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Join the Competition!</h3>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed px-2">
                Create a free account to register for events, secure your spot, and track your tournament performance.
              </p>
              <div className="space-y-3">
                <button onClick={() => router.push('/login')} className="w-full h-12 bg-orange-600 text-white font-bold rounded-xl text-base hover:bg-orange-500 active:scale-95 transition-all shadow-[0_8px_20px_rgba(234,88,12,0.25)]">
                  Sign In / Create Account
                </button>
                <button onClick={() => setShowGuestPrompt(false)} className="w-full h-12 bg-white/5 text-zinc-300 font-bold rounded-xl text-sm hover:bg-white/10 active:scale-95 transition-all">
                  Not Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </main>
  );
}