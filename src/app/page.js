"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext"; // <-- Import Hook

export default function Home() {
  const { t } = useLanguage(); // <-- Init Hook

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState({ rating: 3.5 });
  const [friends, setFriends] = useState([]);
  
  const [viewMode, setViewMode] = useState('manual'); 
  const [matchType, setMatchType] = useState('1v1'); 
  const [teamAScore, setTeamAScore] = useState(11);
  const [teamBScore, setTeamBScore] = useState(9);
  
  const [partner, setPartner] = useState(null);
  const [opponent1, setOpponent1] = useState(null);
  const [opponent2, setOpponent2] = useState(null);

  const [lobbyPin, setLobbyPin] = useState(null);
  const [lobbyState, setLobbyState] = useState(null);
  const [lobbyPlayers, setLobbyPlayers] = useState({}); 
  const [joinPinInput, setJoinPinInput] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [pendingJoinLobby, setPendingJoinLobby] = useState(null); 

  const inputStyle = "block w-full h-12 rounded-xl border border-zinc-800 px-4 text-white bg-zinc-950 focus:border-orange-500 focus:bg-black outline-none transition-all appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const formatName = (email) => email ? email.split('@')[0] : t('common.guest');

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
          alert("Match submitted! Your rating has been updated.");
          window.location.href = "/dashboard";
        }
      }).subscribe();

    return () => supabase.removeChannel(channel);
  }, [lobbyPin, viewMode, pendingJoinLobby]);

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

  const hostLobby = async () => {
    if (!user) return;
    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const { data } = await supabase.from('match_lobbies').insert([{ pin: newPin, host_id: user.id, match_type: matchType }]).select().single();
    setLobbyPin(newPin);
    setLobbyState(data);
  };

  const joinLobby = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { data: lobby } = await supabase.from('match_lobbies').select('*').eq('pin', joinPinInput).eq('status', 'waiting').single();
    if (!lobby) return alert("Invalid PIN.");

    if (user.id === lobby.host_id) return alert("You are the host!");

    if (user.id === lobby.team_a_player2_id || user.id === lobby.team_b_player1_id || user.id === lobby.team_b_player2_id) {
      setLobbyPin(joinPinInput);
      setIsJoined(true);
      return;
    }

    if (lobby.match_type === '1v1') {
      if (!lobby.team_b_player1_id) completeJoin(lobby.pin, 'team_b_player1_id');
      else alert("Full lobby!");
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
    if (scoreA < 11 && scoreB < 11) return alert("Invalid Score!");
    if (Math.abs(scoreA - scoreB) < 2) return alert("Must win by 2!");

    const K_FACTOR = 0.1;
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
    alert("Success! " + newRating);
    window.location.href = "/dashboard";
  };

  const FriendSelect = ({ value, onChange, excludeIds = [] }) => (
    <div className="relative">
      <select 
        className={`${inputStyle} pr-10 truncate`} 
        value={value?.id || ""} 
        onChange={(e) => onChange(friends.find(f => f.id === e.target.value) || null)}
      >
        <option value="" className="bg-zinc-900 text-zinc-400">-- {t('common.guest')} --</option>
        {friends.map(f => {
          const isDisabled = excludeIds.includes(f.id);
          return (
            <option key={f.id} value={f.id} disabled={isDisabled} className={`bg-zinc-900 ${isDisabled ? 'text-zinc-600' : 'text-white'}`}>
              {formatName(f.email)} {isDisabled ? '(Selected)' : `(${Number(f.rating).toFixed(2)})`}
            </option>
          );
        })}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  );

  const PlayerSlotCard = ({ title, playerId, color = 'orange' }) => {
    const p = lobbyPlayers[playerId];
    const textColor = color === 'orange' ? 'text-orange-400' : 'text-blue-400';
    const borderColor = color === 'orange' ? 'border-orange-500/20' : 'border-blue-500/20';

    return (
      <div className={`bg-zinc-950 border ${borderColor} p-4 rounded-xl flex flex-col items-center justify-center h-24 shadow-inner relative overflow-hidden w-full transition-colors`}>
        <p className="text-xs text-zinc-500 font-bold uppercase mb-1 truncate w-full text-center">{title}</p>
        {p ? (
          <p className={`font-extrabold ${textColor} text-center text-sm truncate w-full px-2`}>{formatName(p.email)}</p>
        ) : (
          <div className="flex flex-col items-center">
            <p className="font-medium text-zinc-600 animate-pulse text-sm">{t('common.waiting')}</p>
            <p className="text-[10px] text-zinc-700 font-bold uppercase mt-1 text-center truncate">{t('common.orLeaveGuest')}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-black p-4 md:p-8 flex items-start md:items-center justify-center w-full">
      <div className="bg-zinc-900 p-6 md:p-8 rounded-3xl shadow-2xl border border-zinc-800 w-full max-w-2xl">
        <div className="flex bg-zinc-950 rounded-xl p-1 mb-8 border border-zinc-800">
          <button onClick={() => setViewMode('manual')} className={`flex-1 py-3 rounded-lg font-bold text-xs sm:text-sm transition ${viewMode === 'manual' ? 'bg-zinc-800 text-orange-500 shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('logMatch.manual')}</button>
          <button onClick={() => setViewMode('host')} className={`flex-1 py-3 rounded-lg font-bold text-xs sm:text-sm transition ${viewMode === 'host' ? 'bg-zinc-800 text-orange-500 shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('logMatch.host')}</button>
          <button onClick={() => setViewMode('join')} className={`flex-1 py-3 rounded-lg font-bold text-xs sm:text-sm transition ${viewMode === 'join' ? 'bg-zinc-800 text-orange-500 shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('logMatch.join')}</button>
        </div>

        {viewMode === 'manual' && (
          <form onSubmit={(e) => submitMatch(e, false)}>
            <div className="flex bg-zinc-950 rounded-lg p-1 mb-6 border border-zinc-800">
              <button type="button" onClick={() => setMatchType('1v1')} className={`flex-1 py-2 rounded font-bold text-sm ${matchType === '1v1' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>1v1</button>
              <button type="button" onClick={() => setMatchType('2v2')} className={`flex-1 py-2 rounded font-bold text-sm ${matchType === '2v2' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>2v2</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-950/50 p-6 rounded-2xl border border-zinc-800 mb-8">
              <div className="space-y-4">
                <h3 className="font-extrabold text-orange-500 border-b border-orange-500/20 pb-2">{t('logMatch.yourTeam')}</h3>
                <div><label className="block text-sm font-semibold text-zinc-400 mb-1">{t('logMatch.player1')}</label><input type="text" disabled value="You" className={`${inputStyle} text-zinc-500 cursor-not-allowed`} /></div>
                
                {matchType === '2v2' && (
                  <div>
                    <label className="block text-sm font-semibold text-zinc-400 mb-1">{t('logMatch.partner')}</label>
                    <FriendSelect value={partner} onChange={setPartner} excludeIds={[opponent1?.id, opponent2?.id].filter(Boolean)} />
                  </div>
                )}
                
                <div><label className="block text-sm font-semibold text-orange-400 mb-1 mt-4">{t('logMatch.scoreA')}</label><input type="number" min="0" required value={teamAScore} onChange={(e) => setTeamAScore(Math.max(0, e.target.value))} className={`${inputStyle} focus:border-orange-500`} /></div>
              </div>
              <div className="space-y-4">
                <h3 className="font-extrabold text-blue-400 border-b border-blue-500/20 pb-2">{t('logMatch.opponents')}</h3>
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-1">{t('logMatch.opponent1')}</label>
                  <FriendSelect value={opponent1} onChange={setOpponent1} excludeIds={[partner?.id, opponent2?.id].filter(Boolean)} />
                </div>
                
                {matchType === '2v2' && (
                  <div>
                    <label className="block text-sm font-semibold text-zinc-400 mb-1">{t('logMatch.opponent2')}</label>
                    <FriendSelect value={opponent2} onChange={setOpponent2} excludeIds={[partner?.id, opponent1?.id].filter(Boolean)} />
                  </div>
                )}
                
                <div><label className="block text-sm font-semibold text-blue-400 mb-1 mt-4">{t('logMatch.scoreB')}</label><input type="number" min="0" required value={teamBScore} onChange={(e) => setTeamBScore(Math.max(0, e.target.value))} className={`${inputStyle} focus:border-blue-500`} /></div>
              </div>
            </div>
            <button type="submit" className="w-full bg-orange-600 text-white font-extrabold py-4 rounded-xl hover:bg-orange-500 transition shadow-lg">{t('logMatch.submit')}</button>
          </form>
        )}

        {viewMode === 'host' && (
          <div>
            {!lobbyPin ? (
              <div className="text-center py-8">
                <h2 className="text-2xl font-bold text-white mb-4">{t('logMatch.startLive')}</h2>
                <div className="flex bg-zinc-950 rounded-lg p-1 mb-6 border border-zinc-800 max-w-xs mx-auto">
                  <button type="button" onClick={() => setMatchType('1v1')} className={`flex-1 py-2 rounded font-bold text-sm ${matchType === '1v1' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>1v1</button>
                  <button type="button" onClick={() => setMatchType('2v2')} className={`flex-1 py-2 rounded font-bold text-sm ${matchType === '2v2' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}>2v2</button>
                </div>
                <button onClick={hostLobby} className="bg-orange-600 text-white font-extrabold py-4 px-8 rounded-xl hover:bg-orange-500 shadow-lg shadow-orange-900/50 text-lg">{t('logMatch.generatePin')}</button>
              </div>
            ) : (
              <form onSubmit={(e) => submitMatch(e, true)}>
                <div className="text-center mb-8 bg-zinc-950 py-6 rounded-2xl border border-zinc-800 relative">
                  <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">{t('logMatch.matchPin')}</p>
                  <p className="text-6xl sm:text-8xl font-black text-orange-500 tracking-widest drop-shadow-md">{lobbyPin}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="flex flex-col gap-3 bg-orange-950/10 border border-orange-500/20 p-3 rounded-2xl">
                    <h3 className="text-center font-black text-orange-500 text-xs uppercase tracking-widest">{t('logMatch.teamA')}</h3>
                    <PlayerSlotCard title={t('logMatch.hostRole')} playerId={lobbyState?.host_id} color="orange" />
                    {lobbyState?.match_type === '2v2' && <PlayerSlotCard title={t('logMatch.partner')} playerId={lobbyState?.team_a_player2_id} color="orange" />}
                  </div>
                  <div className="flex flex-col gap-3 bg-blue-950/10 border border-blue-500/20 p-3 rounded-2xl">
                    <h3 className="text-center font-black text-blue-400 text-xs uppercase tracking-widest">{t('logMatch.teamB')}</h3>
                    <PlayerSlotCard title={t('logMatch.p1Role')} playerId={lobbyState?.team_b_player1_id} color="blue" />
                    {lobbyState?.match_type === '2v2' && <PlayerSlotCard title={t('logMatch.p2Role')} playerId={lobbyState?.team_b_player2_id} color="blue" />}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl animate-fade-in">
                  <div>
                    <label className="block text-center text-sm font-bold text-orange-500 mb-2 truncate">{t('logMatch.scoreA')}</label>
                    <input type="number" min="0" required value={teamAScore} onChange={(e) => setTeamAScore(Math.max(0, e.target.value))} className={`${inputStyle} text-center text-2xl font-black focus:border-orange-500`} />
                  </div>
                  <div>
                    <label className="block text-center text-sm font-bold text-blue-400 mb-2 truncate">{t('logMatch.scoreB')}</label>
                    <input type="number" min="0" required value={teamBScore} onChange={(e) => setTeamBScore(Math.max(0, e.target.value))} className={`${inputStyle} text-center text-2xl font-black focus:border-blue-500`} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-orange-600 text-white font-extrabold py-4 rounded-xl hover:bg-orange-500 shadow-lg text-lg">{t('logMatch.submit')}</button>
                <p className="text-center text-xs text-zinc-500 mt-4 truncate">{t('logMatch.unfilled')}</p>
              </form>
            )}
          </div>
        )}

        {viewMode === 'join' && (
          <div className="text-center py-8">
            {!isJoined && !pendingJoinLobby && (
              <form onSubmit={joinLobby}>
                <h2 className="text-2xl font-bold text-white mb-2">{t('logMatch.joinLive')}</h2>
                <input type="text" maxLength="4" required value={joinPinInput} onChange={(e) => setJoinPinInput(e.target.value)} placeholder="0000" className="block w-full h-24 rounded-2xl border border-zinc-800 text-center text-6xl font-black text-white bg-zinc-950 focus:border-orange-500 outline-none transition-all mb-6 tracking-widest" />
                <button type="submit" className="w-full bg-white text-black font-extrabold py-4 rounded-xl">{t('logMatch.findMatch')}</button>
              </form>
            )}

            {pendingJoinLobby && !isJoined && (
              <div className="animate-fade-in text-left">
                <h2 className="text-2xl font-bold text-white mb-2 text-center">{t('logMatch.chooseTeam')}</h2>
                <p className="text-zinc-400 mb-6 text-center">{t('logMatch.selectPosition')}</p>
                
                <div className="space-y-4 max-w-sm mx-auto">
                  <button 
                    onClick={() => completeJoin(pendingJoinLobby.pin, 'team_a_player2_id')}
                    disabled={pendingJoinLobby.team_a_player2_id !== null}
                    className={`w-full py-4 px-6 rounded-xl font-bold transition flex justify-between items-center ${pendingJoinLobby.team_a_player2_id ? 'bg-zinc-950 text-zinc-600 cursor-not-allowed border border-zinc-800' : 'bg-orange-600/10 text-orange-400 border border-orange-500/30 hover:bg-orange-600/20'}`}
                  >
                    <span>{t('logMatch.teamA')} ({t('logMatch.partner')})</span>
                    {pendingJoinLobby.team_a_player2_id ? <span className="text-xs uppercase bg-zinc-900 px-2 py-1 rounded">{t('logMatch.taken')}</span> : <span>{t('logMatch.joinBtn')}</span>}
                  </button>

                  <button 
                    onClick={() => completeJoin(pendingJoinLobby.pin, 'team_b_player1_id')}
                    disabled={pendingJoinLobby.team_b_player1_id !== null}
                    className={`w-full py-4 px-6 rounded-xl font-bold transition flex justify-between items-center ${pendingJoinLobby.team_b_player1_id ? 'bg-zinc-950 text-zinc-600 cursor-not-allowed border border-zinc-800' : 'bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600/20'}`}
                  >
                    <span>{t('logMatch.teamB')} ({t('logMatch.p1Role')})</span>
                    {pendingJoinLobby.team_b_player1_id ? <span className="text-xs uppercase bg-zinc-900 px-2 py-1 rounded">{t('logMatch.taken')}</span> : <span>{t('logMatch.joinBtn')}</span>}
                  </button>

                  <button 
                    onClick={() => completeJoin(pendingJoinLobby.pin, 'team_b_player2_id')}
                    disabled={pendingJoinLobby.team_b_player2_id !== null}
                    className={`w-full py-4 px-6 rounded-xl font-bold transition flex justify-between items-center ${pendingJoinLobby.team_b_player2_id ? 'bg-zinc-950 text-zinc-600 cursor-not-allowed border border-zinc-800' : 'bg-blue-600/10 text-blue-400 border border-blue-500/30 hover:bg-blue-600/20'}`}
                  >
                    <span>{t('logMatch.teamB')} ({t('logMatch.p2Role')})</span>
                    {pendingJoinLobby.team_b_player2_id ? <span className="text-xs uppercase bg-zinc-900 px-2 py-1 rounded">{t('logMatch.taken')}</span> : <span>{t('logMatch.joinBtn')}</span>}
                  </button>
                </div>
                
                <div className="text-center mt-6">
                  <button onClick={() => setPendingJoinLobby(null)} className="text-sm text-zinc-500 font-bold hover:text-white transition underline underline-offset-4">{t('logMatch.cancel')}</button>
                </div>
              </div>
            )}

            {isJoined && (
              <div className="py-12"><div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div><h2 className="text-2xl font-extrabold text-white">{t('logMatch.youAreIn')}</h2></div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}