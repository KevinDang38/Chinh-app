"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { User, Users, Trophy, Plus } from "lucide-react";

const formatName = (email, t) => {
  if (!email) return t('common.guest');
  const name = email.split('@')[0];
  return name.length > 10 ? name.substring(0, 9) + '...' : name;
};

const getInitials = (email) => email ? email.substring(0, 2).toUpperCase() : '?';

const PlayerRowDisplay = ({ player, label, color, currentUser, t }) => {
  const isOrange = color === 'orange';
  const borderGlow = isOrange ? 'border-orange-500/50 text-orange-400' : 'border-blue-500/50 text-blue-400';
  return (
    <div className="flex items-center gap-3 w-full">
      <div className={`w-10 h-10 shrink-0 rounded-full border bg-black flex items-center justify-center font-black text-xs shadow-inner ${borderGlow}`}>
        {player === 'YOU' ? 'ME' : getInitials(player?.email)}
      </div>
      <div className="flex flex-col overflow-hidden w-full text-left">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{label}</span>
        <span className="text-white font-bold text-sm truncate">
          {player === 'YOU' ? formatName(currentUser?.email, t) : formatName(player?.email, t)}
        </span>
      </div>
    </div>
  );
};

const LivePlayerRow = ({ title, playerId, color, lobbyPlayers, t }) => {
  const p = lobbyPlayers[playerId];
  const isOrange = color === 'orange';
  const borderGlow = isOrange ? 'border-orange-500/50 text-orange-400' : 'border-blue-500/50 text-blue-400';

  return (
    <div className="flex items-center gap-3 w-full">
      {p ? (
        <>
          <div className={`w-10 h-10 shrink-0 rounded-full border bg-black flex items-center justify-center font-black text-xs shadow-inner ${borderGlow}`}>
            {getInitials(p.email)}
          </div>
          <div className="flex flex-col overflow-hidden w-full text-left">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{title}</span>
            <span className="text-white font-bold text-sm truncate">{formatName(p.email, t)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="w-10 h-10 shrink-0 rounded-full border border-dashed border-zinc-700 flex items-center justify-center animate-spin-slow bg-white/5"></div>
          <div className="flex flex-col overflow-hidden w-full text-left">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{title}</span>
            <span className="text-zinc-500 font-bold text-sm truncate animate-pulse">{t('common.waiting')}</span>
          </div>
        </>
      )}
    </div>
  );
};

const JoinSlotButton = ({ title, playerId, color, onClick, t }) => {
  const isTaken = playerId !== null;
  const isOrange = color === 'orange';
  const activeClass = isOrange 
      ? 'bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-orange-400' 
      : 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-400';
  const takenClass = 'bg-black/40 border-white/5 text-zinc-600 cursor-not-allowed';

  return (
      <button 
          onClick={onClick} 
          disabled={isTaken}
          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${!isTaken && 'active:scale-95'} ${isTaken ? takenClass : activeClass}`}
      >
          <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs border shadow-inner ${isTaken ? 'border-zinc-800 bg-zinc-900' : (isOrange ? 'border-orange-500/50 bg-black' : 'border-blue-500/50 bg-black')}`}>
                  {isTaken ? <User size={16} /> : <Plus size={16} />}
              </div>
              <div className="flex flex-col items-start">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{title}</span>
                  <span className={`font-bold text-sm ${isTaken ? 'text-zinc-600' : 'text-white'}`}>{isTaken ? t('logMatch.taken') : t('logMatch.joinBtn')}</span>
              </div>
          </div>
      </button>
  );
};

const SmartScoreInput = ({ score, setScore, color }) => {
  const activeBorder = color === 'orange' ? 'focus:border-orange-500 text-orange-400' : 'focus:border-blue-500 text-blue-400';
  return (
    <input 
      type="text" 
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={score} 
      onChange={(e) => setScore(e.target.value.replace(/\D/g, ''))} 
      className={`w-20 h-20 shrink-0 text-center text-4xl font-black bg-black/40 border border-white/10 rounded-2xl outline-none transition-all shadow-inner ${activeBorder}`}
    />
  );
};

const PlayerChipSelector = ({ title, selected, onChange, excludeIds = [], color, friends, t }) => {
  const activeClass = color === 'orange' 
    ? 'bg-orange-500/20 text-orange-400 border-orange-500/50' 
    : 'bg-blue-500/20 text-blue-400 border-blue-500/50';
  const inactiveClass = 'glass-card text-zinc-400 hover:text-white hover:bg-white/5 border-white/5';

  return (
    <div className="mt-4 text-left">
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-1">{title}</p>
      <div className="flex flex-wrap gap-2">
        <button 
          type="button" 
          onClick={() => onChange(null)} 
          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${!selected ? activeClass : inactiveClass}`}
        >
          {t('common.guest')}
        </button>
        
        {friends.map(f => {
          if (excludeIds.includes(f.id)) return null;
          const isSelected = selected?.id === f.id;
          return (
            <button 
              key={f.id} 
              type="button" 
              onClick={() => onChange(f)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${isSelected ? activeClass : inactiveClass}`}
            >
              {formatName(f.email, t)}
            </button>
          )
        })}
      </div>
    </div>
  );
};

const pageVariants = {
  initial: { opacity: 0, y: 15, scale: 0.98, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, y: -15, scale: 0.98, filter: "blur(4px)" }
};

const pageTransition = { duration: 0.3, ease: "easeOut" };

export default function Home() {
  const { t } = useLanguage();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ rating: 3.5 });
  const [friends, setFriends] = useState([]);
  
  const [viewMode, setViewMode] = useState('manual'); 
  const [matchType, setMatchType] = useState('1v1'); 
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

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userId = session.user.id;
        setUser(session.user);
        const { data: userProfile } = await supabase.from('profiles').select('rating').eq('id', userId).single();
        if (userProfile) setProfile(userProfile);

        const { data: connections } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

        if (connections && connections.length > 0) {
          const friendIds = [...new Set(connections.map(c => c.user_id === userId ? c.friend_id : c.user_id))];
          const { data: friendProfiles } = await supabase.from('profiles').select('id, email, rating, profile_hash').in('id', friendIds);
          if (friendProfiles) setFriends(friendProfiles);
        } else {
          setFriends([]);
        }
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!lobbyPin) return;

    const channel = supabase.channel(`lobby-${lobbyPin}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_lobbies', filter: `pin=eq.${lobbyPin}` }, (payload) => {
        setLobbyState(payload.new);
        if (pendingJoinLobby) setPendingJoinLobby(payload.new);
        
        if (payload.new.status === 'completed' && viewMode === 'join') {
          alert(t('alerts.matchSubmitted'));
          window.location.href = "/dashboard";
        }

        if (payload.new.status === 'cancelled' && viewMode === 'join') {
          alert(t('alerts.lobbyCancelled'));
          setLobbyPin(null);
          setLobbyState(null);
          setIsJoined(false);
          setPendingJoinLobby(null);
        }
      }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [lobbyPin, viewMode, pendingJoinLobby, t]);

  useEffect(() => {
    if (!lobbyState) return;
    const fetchProfiles = async () => {
      const ids = [lobbyState.host_id, lobbyState.team_a_player2_id, lobbyState.team_b_player1_id, lobbyState.team_b_player2_id].filter(Boolean);
      const { data } = await supabase.from('profiles').select('id, email, rating').in('id', ids);
      if (data) {
        const map = {};
        data.forEach(p => map[p.id] = p);
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

  const hostLobby = async () => {
    if (!user) return;
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const { data } = await supabase.from('match_lobbies').insert([{ pin: newPin, host_id: user.id, match_type: matchType }]).select().single();
    setLobbyPin(newPin);
    setLobbyState(data);
  };

  const cancelLobby = async () => {
    if (lobbyPin) {
      await supabase.from('match_lobbies').update({ status: 'cancelled' }).eq('pin', lobbyPin);
    }
    setLobbyPin(null);
    setLobbyState(null);
    setLobbyPlayers({});
    setTeamAScore("11");
    setTeamBScore("9");
  };

  const joinLobby = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { data: lobby } = await supabase.from('match_lobbies').select('*').eq('pin', joinPinInput).eq('status', 'waiting').single();
    if (!lobby) return alert(t('alerts.invalidPin'));

    if (user.id === lobby.host_id) return alert(t('alerts.alreadyHost'));

    if (user.id === lobby.team_a_player2_id || user.id === lobby.team_b_player1_id || user.id === lobby.team_b_player2_id) {
      setLobbyPin(joinPinInput);
      setIsJoined(true);
      return;
    }

    if (lobby.match_type === '1v1') {
      if (!lobby.team_b_player1_id) completeJoin(lobby.pin, 'team_b_player1_id');
      else alert(t('alerts.lobbyFull'));
    } else {
      setPendingJoinLobby(lobby); 
    }
  };

  const completeJoin = async (pin, slot) => {
    await supabase.from('match_lobbies').update({ [slot]: user.id }).eq('pin', pin);
    setLobbyPin(pin);
    setPendingJoinLobby(null);
    setIsJoined(true);
  };

  const submitMatch = async (e, isLive = false) => {
    e.preventDefault();
    if (!user) return;

    const scoreA = Number(teamAScore);
    const scoreB = Number(teamBScore);
    
    const maxScore = Math.max(scoreA, scoreB);
    const minScore = Math.min(scoreA, scoreB);
    const margin = maxScore - minScore;

    const isStandardWin = (maxScore === 11 || maxScore === 15 || maxScore === 21) && margin >= 2;
    const isOvertimeWin = maxScore > 11 && margin === 2;

    if (!isStandardWin && !isOvertimeWin) {
      return alert(t('alerts.invalidPickleballScore'));
    }

    let K_FACTOR = 0.1; 

    const { count: userMatchCount, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .or(`player_a_id.eq.${user.id},team_a_player2_id.eq.${user.id},team_b_player1_id.eq.${user.id},team_b_player2_id.eq.${user.id}`);

    if (!countError) {
      if (userMatchCount < 10) {
        K_FACTOR = 0.2; 
      } else if (userMatchCount >= 40) {
        K_FACTOR = 0.05; 
      }
    }

    let pA = profile.rating, pB = profile.rating, o1 = 3.5, o2 = 3.5;

    if (isLive) {
      if (lobbyState.match_type === '2v2' && lobbyPlayers[lobbyState.team_a_player2_id]) pB = lobbyPlayers[lobbyState.team_a_player2_id].rating;
      if (lobbyPlayers[lobbyState.team_b_player1_id]) o1 = lobbyPlayers[lobbyState.team_b_player1_id].rating;
      if (lobbyPlayers[lobbyState.team_b_player2_id]) o2 = lobbyPlayers[lobbyState.team_b_player2_id].rating;
    } else {
      if (matchType === '2v2' && partner) pB = partner.rating;
      if (opponent1) o1 = opponent1.rating;
      if (matchType === '2v2' && opponent2) o2 = opponent2.rating;
    }

    const teamARating = (matchType === '2v2' || (isLive && lobbyState.match_type === '2v2')) ? (pA + pB) / 2 : pA;
    const teamBRating = (matchType === '2v2' || (isLive && lobbyState.match_type === '2v2')) ? (o1 + o2) / 2 : o1;
    
    const expectedScore = 1 / (1 + Math.pow(10, (teamBRating - teamARating) / 1.0));
    const totalPoints = scoreA + scoreB;
    const actualScore = scoreA / totalPoints;
    
    const newRating = (profile.rating + K_FACTOR * (actualScore - expectedScore)).toFixed(3);
    const ratingChange = Number(newRating) - profile.rating;

    await supabase.from('matches').insert([{ 
      match_type: isLive ? lobbyState.match_type : matchType,
      player_a_id: user.id, 
      team_a_player2_id: isLive ? lobbyState.team_a_player2_id : (partner ? partner.id : null),
      team_b_player1_id: isLive ? lobbyState.team_b_player1_id : (opponent1 ? opponent1.id : null),
      team_b_player2_id: isLive ? lobbyState.team_b_player2_id : (opponent2 ? opponent2.id : null),
      player_a_score: scoreA, 
      player_b_score: scoreB,
      rating_change: ratingChange 
    }]);

    await supabase.from('profiles').update({ rating: Number(newRating) }).eq('id', user.id);
    if (isLive) await supabase.from('match_lobbies').update({ status: 'completed' }).eq('pin', lobbyPin);
    
    alert(`${t('alerts.successNewRating')} ${newRating}`);
    window.location.href = "/dashboard";
  };

  return (
    <main 
      className="min-h-screen px-4 py-6 md:p-8 w-full pb-24 overflow-y-auto overflow-x-hidden touch-pan-y text-center bg-[#050507]" 
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        
        <div className="flex glass-card rounded-2xl p-1.5 mb-6 relative z-20 shadow-xl border border-white/5 bg-black/40">
          {['manual', 'host', 'join'].map((tab) => (
            <button
              key={tab}
              onClick={() => setViewMode(tab)}
              className={`relative flex-1 py-3 rounded-xl font-bold text-sm outline-none transition-colors duration-300 ${
                viewMode === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {viewMode === tab && (
                <motion.div
                  layoutId="viewModeIndicator"
                  className="absolute inset-0 bg-white/10 rounded-xl shadow-md border border-white/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 block tracking-wide">
                {t(`logMatch.${tab}`)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative">
          <AnimatePresence mode="wait">
            
            {viewMode === 'manual' && (
              <motion.div 
                key="manual" 
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
                className="space-y-6"
              >
                
                <div className="flex glass-card rounded-xl p-1 mb-2 border border-white/5 bg-black/40">
                  {['1v1', '2v2'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleMatchTypeToggle(type)}
                      className={`relative flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm outline-none transition-colors duration-300 ${
                        matchType === type ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {matchType === type && (
                        <motion.div
                          layoutId="manualMatchIndicator"
                          className="absolute inset-0 bg-white/10 rounded-lg shadow-md border border-white/10"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        {type === '1v1' ? <User size={16}/> : <Users size={16}/>} {type}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="glass-panel p-5 sm:p-6 rounded-4xl relative overflow-hidden shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
                  <div className="relative z-10">
                    <h3 className="font-black text-orange-500 uppercase tracking-widest mb-4 text-xs text-left">{t('logMatch.yourTeam')}</h3>
                    <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <div className="flex flex-col gap-3 w-full overflow-hidden pr-4">
                        <PlayerRowDisplay player="YOU" label={t('logMatch.player1')} color="orange" currentUser={user} t={t} />
                        {matchType === '2v2' && (
                          <PlayerRowDisplay player={partner} label={t('logMatch.partner')} color="orange" currentUser={user} t={t} />
                        )}
                      </div>
                      <SmartScoreInput score={teamAScore} setScore={setTeamAScore} color="orange" />
                    </div>
                    {matchType === '2v2' && (
                      <PlayerChipSelector title={`${t('logMatch.partner')}:`} selected={partner} onChange={setPartner} excludeIds={[opponent1?.id, opponent2?.id].filter(Boolean)} color="orange" friends={friends} t={t} />
                    )}
                  </div>
                </div>

                <div className="glass-panel p-5 sm:p-6 rounded-4xl relative overflow-hidden shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
                  <div className="relative z-10">
                    <h3 className="font-black text-blue-400 uppercase tracking-widest mb-4 text-xs text-left">{t('logMatch.opponents')}</h3>
                    <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                      <div className="flex flex-col gap-3 w-full overflow-hidden pr-4">
                        <PlayerRowDisplay player={opponent1} label={t('logMatch.opponent1')} color="blue" currentUser={user} t={t} />
                        {matchType === '2v2' && (
                          <PlayerRowDisplay player={opponent2} label={t('logMatch.opponent2')} color="blue" currentUser={user} t={t} />
                        )}
                      </div>
                      <SmartScoreInput score={teamBScore} setScore={setTeamBScore} color="blue" />
                    </div>
                    <PlayerChipSelector title={`${t('logMatch.opponent1')}:`} selected={opponent1} onChange={setOpponent1} excludeIds={[partner?.id, opponent2?.id].filter(Boolean)} color="blue" friends={friends} t={t} />
                    {matchType === '2v2' && (
                      <PlayerChipSelector title={`${t('logMatch.opponent2')}:`} selected={opponent2} onChange={setOpponent2} excludeIds={[partner?.id, opponent1?.id].filter(Boolean)} color="blue" friends={friends} t={t} />
                    )}
                  </div>
                </div>

                <button onClick={(e) => submitMatch(e, false)} className="w-full bg-orange-600 text-white font-black py-5 rounded-3xl text-lg hover:bg-orange-500 active:scale-95 transition-all shadow-[0_15px_40px_rgba(234,88,12,0.3)] flex items-center justify-center gap-2">
                  <Trophy size={20} /> {t('logMatch.submit')}
                </button>
              </motion.div>
            )}

            {viewMode === 'host' && (
              <motion.div 
                key="host" 
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                {!lobbyPin ? (
                  <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                    <div className="text-center py-6">
                      <div className="w-20 h-20 glass-card rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-white/10">
                        <Users className="w-10 h-10 text-white" />
                      </div>
                      <h2 className="text-2xl font-black text-white mb-2">{t('logMatch.startLive')}</h2>
                      <p className="text-zinc-400 text-sm mb-8">
                        {t('logMatch.hostDesc')}
                      </p>
                      
                      <div className="flex glass-card rounded-xl p-1 mb-8 max-w-xs mx-auto border border-white/5 bg-black/40">
                        {['1v1', '2v2'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleMatchTypeToggle(type)}
                            className={`relative flex-1 py-3 rounded-lg font-bold text-sm outline-none transition-colors duration-300 ${
                              matchType === type ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                          >
                            {matchType === type && (
                              <motion.div
                                layoutId="hostMatchIndicator"
                                className="absolute inset-0 bg-white/10 rounded-lg shadow-md border border-white/10"
                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                              />
                            )}
                            <span className="relative z-10 tracking-wide">{type}</span>
                          </button>
                        ))}
                      </div>
                      
                      <button onClick={hostLobby} className="w-full bg-orange-600 text-white font-black py-5 rounded-3xl text-lg hover:bg-orange-500 active:scale-95 transition-all shadow-[0_15px_40px_rgba(234,88,12,0.3)]">
                        {t('logMatch.generatePin')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-center mb-8">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3">{t('logMatch.matchPin')}</p>
                      <div className="inline-block bg-white/5 border border-white/10 px-10 py-4 rounded-4xl shadow-inner">
                        <p className="text-6xl sm:text-7xl font-black text-white tracking-[0.2em] drop-shadow-md">{lobbyPin}</p>
                      </div>
                    </div>
                    
                    <div className="glass-panel p-5 sm:p-6 rounded-4xl relative overflow-hidden mb-6 shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
                      <div className="relative z-10">
                        <h3 className="font-black text-orange-500 uppercase tracking-widest mb-4 text-xs text-left">{t('logMatch.teamA')}</h3>
                        <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                          <div className="flex flex-col gap-3 w-full overflow-hidden pr-4">
                            <LivePlayerRow title={t('logMatch.hostRole')} playerId={lobbyState?.host_id} color="orange" lobbyPlayers={lobbyPlayers} t={t} />
                            {lobbyState?.match_type === '2v2' && (
                              <LivePlayerRow title={t('logMatch.partner')} playerId={lobbyState?.team_a_player2_id} color="orange" lobbyPlayers={lobbyPlayers} t={t} />
                            )}
                          </div>
                          <SmartScoreInput score={teamAScore} setScore={setTeamAScore} color="orange" />
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel p-5 sm:p-6 rounded-4xl relative overflow-hidden mb-8 shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
                      <div className="relative z-10">
                        <h3 className="font-black text-blue-400 uppercase tracking-widest mb-4 text-xs text-left">{t('logMatch.teamB')}</h3>
                        <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                          <div className="flex flex-col gap-3 w-full overflow-hidden pr-4">
                            <LivePlayerRow title={t('logMatch.p1Role')} playerId={lobbyState?.team_b_player1_id} color="blue" lobbyPlayers={lobbyPlayers} t={t} />
                            {lobbyState?.match_type === '2v2' && (
                              <LivePlayerRow title={t('logMatch.p2Role')} playerId={lobbyState?.team_b_player2_id} color="blue" lobbyPlayers={lobbyPlayers} t={t} />
                            )}
                          </div>
                          <SmartScoreInput score={teamBScore} setScore={setTeamBScore} color="blue" />
                        </div>
                      </div>
                    </div>

                    <button onClick={(e) => submitMatch(e, true)} className="w-full bg-orange-600 text-white font-black py-5 rounded-3xl text-lg hover:bg-orange-500 active:scale-95 transition-all shadow-[0_15px_40px_rgba(234,88,12,0.3)] flex items-center justify-center gap-2">
                      <Trophy size={20} /> {t('logMatch.submit')}
                    </button>

                    <button onClick={cancelLobby} className="w-full mt-6 py-4 text-sm font-bold text-zinc-500 hover:text-white transition-colors">
                      {t('logMatch.cancel')}
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {viewMode === 'join' && (
              <motion.div 
                key="join" 
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={pageTransition}
              >
                {!isJoined && !pendingJoinLobby && (
                  <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] text-center border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                    <form onSubmit={joinLobby} className="py-6">
                      <h2 className="text-2xl font-black text-white mb-2">{t('logMatch.joinLive')}</h2>
                      <p className="text-zinc-400 text-sm mb-8">
                        {t('logMatch.joinDesc')}
                      </p>
                      
                      <input 
                        type="text" 
                        inputMode="numeric"
                        maxLength="4" 
                        required 
                        value={joinPinInput} 
                        onChange={(e) => setJoinPinInput(e.target.value.replace(/\D/g, ''))} 
                        placeholder="0000" 
                        className="block w-full h-32 rounded-4xl bg-black/40 border border-white/10 text-center text-7xl font-black text-white focus:border-orange-500 outline-none transition-all mb-8 tracking-[0.2em] shadow-inner placeholder-zinc-800" 
                      />
                      
                      <button type="submit" className="w-full bg-orange-600 text-white font-black py-5 rounded-3xl text-lg hover:bg-orange-500 active:scale-95 transition-all shadow-[0_15px_40px_rgba(234,88,12,0.3)]">
                        {t('logMatch.joinBtn')}
                      </button>
                    </form>
                  </div>
                )}

                {pendingJoinLobby && !isJoined && (
                  <div className="glass-panel p-6 sm:p-8 rounded-[2.5rem] text-left border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                    <h2 className="text-2xl font-black text-white mb-2 text-center">{t('logMatch.chooseTeam')}</h2>
                    <p className="text-zinc-400 text-sm mb-8 text-center">{t('logMatch.selectPosition')}</p>
                    
                    <div className="space-y-4">
                      <JoinSlotButton 
                        title={`${t('logMatch.teamA')} - ${t('logMatch.partner')}`} 
                        playerId={pendingJoinLobby.team_a_player2_id} 
                        color="orange" 
                        onClick={() => completeJoin(pendingJoinLobby.pin, 'team_a_player2_id')} 
                        t={t} 
                      />
                      <JoinSlotButton 
                        title={`${t('logMatch.teamB')} - ${t('logMatch.p1Role')}`} 
                        playerId={pendingJoinLobby.team_b_player1_id} 
                        color="blue" 
                        onClick={() => completeJoin(pendingJoinLobby.pin, 'team_b_player1_id')} 
                        t={t} 
                      />
                      <JoinSlotButton 
                        title={`${t('logMatch.teamB')} - ${t('logMatch.p2Role')}`} 
                        playerId={pendingJoinLobby.team_b_player2_id} 
                        color="blue" 
                        onClick={() => completeJoin(pendingJoinLobby.pin, 'team_b_player2_id')} 
                        t={t} 
                      />
                    </div>
                    
                    <button onClick={() => setPendingJoinLobby(null)} className="w-full mt-6 py-4 text-sm font-bold text-zinc-500 hover:text-white transition-colors text-center">
                      {t('logMatch.cancel')}
                    </button>
                  </div>
                )}

                {isJoined && (
                  <div className="glass-panel p-6 sm:p-12 rounded-[2.5rem] flex flex-col items-center border border-white/5 bg-linear-to-br from-white/3 to-transparent">
                    <div className="relative mb-8 mt-4">
                      <div className="w-24 h-24 border-4 border-white/10 border-t-orange-500 rounded-full animate-spin"></div>
                      <Users className="w-8 h-8 text-orange-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">{t('logMatch.youAreIn')}</h2>
                    <p className="text-zinc-400 text-sm mb-4">
                      {t('logMatch.waitingForHost')}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </div>
    </main>
  );
}