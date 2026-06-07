"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "../../../context/LanguageContext"; // <-- Import Hook

export default function UserProfile() {
  const { id } = useParams(); 
  const router = useRouter();
  const { t } = useLanguage(); // <-- Init Hook
  
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  
  const [singlesMatches, setSinglesMatches] = useState([]);
  const [doublesMatches, setDoublesMatches] = useState([]);
  const [matchTab, setMatchTab] = useState('1v1');

  const [friends, setFriends] = useState([]);
  const [isFriend, setIsFriend] = useState(false);
  const [stats, setStats] = useState({ wins: 0, losses: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const formatName = (email) => email ? email.split('@')[0] : t('common.guest');

  useEffect(() => {
    const fetchAllData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      // 1. Fetch Profile using the Hash
      const { data: profileData } = await supabase.from('profiles').select('*').eq('profile_hash', id).single();
      if (!profileData) return router.push("/dashboard");
      setProfile(profileData);

      const targetUserId = profileData.id; 

      // 2. Check if already friends
      if (session) {
        const { data: check1 } = await supabase.from('friends').select('*').eq('user_id', session.user.id).eq('friend_id', targetUserId).single();
        const { data: check2 } = await supabase.from('friends').select('*').eq('user_id', targetUserId).eq('friend_id', session.user.id).single();
        if (check1 || check2) setIsFriend(true);
      }

      // 3. Two-Step Bulletproof Fetch for Target User's Friends
      const { data: connections } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .or(`user_id.eq.${targetUserId},friend_id.eq.${targetUserId}`);

      if (connections && connections.length > 0) {
        const friendIds = [...new Set(connections.map(c => c.user_id === targetUserId ? c.friend_id : c.user_id))];
        const { data: friendProfiles } = await supabase.from('profiles').select('id, email, rating, profile_hash').in('id', friendIds);
        if (friendProfiles) setFriends(friendProfiles);
      } else {
        setFriends([]);
      }

      // 4. Fetch Match History
      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .or(`player_a_id.eq.${targetUserId},team_a_player2_id.eq.${targetUserId},team_b_player1_id.eq.${targetUserId},team_b_player2_id.eq.${targetUserId}`)
        .order('created_at', { ascending: false });

      if (matchData) {
        // Populate the Singles/Doubles Tabs
        setSinglesMatches(matchData.filter(m => m.match_type !== '2v2'));
        setDoublesMatches(matchData.filter(m => m.match_type === '2v2'));
        
        // Calculate cumulative totals across ALL match types
        let wins = 0;
        let losses = 0;
        matchData.forEach(m => {
          const isTeamA = m.player_a_id === targetUserId || m.team_a_player2_id === targetUserId;
          const teamAWon = m.player_a_score > m.player_b_score;
          if ((isTeamA && teamAWon) || (!isTeamA && !teamAWon)) wins++;
          else losses++;
        });
        setStats({ wins, losses, total: matchData.length });
      }
      setLoading(false);
    };
    fetchAllData();
  }, [id, router]);

  const handleAddFriend = async () => {
    if (!currentUser) return alert(t('profile.loginToAdd'));
    const { error } = await supabase.from('friends').insert([{ user_id: currentUser.id, friend_id: profile.id }]);
    if (error) alert("Error: " + error.message);
    else {
      setIsFriend(true);
      alert(t('profile.friendAdded'));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black font-bold text-zinc-500">{t('common.loading')}</div>;

  const displayMatches = (matchTab === '1v1' ? singlesMatches : doublesMatches).slice(0, 5);

  return (
    <main className="min-h-screen bg-black p-4 md:p-8 w-full">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-orange-500"></div>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="w-full md:w-auto overflow-hidden">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 truncate">{profile.email}</h1>
              <p className="text-sm font-bold text-zinc-500">{t('profile.profileId')}: {profile.profile_hash}</p>
            </div>
            <div className="text-left md:text-right">
              <p className="text-xs text-orange-400 font-bold uppercase tracking-widest mb-1">{t('profile.duprRating')}</p>
              <p className="text-5xl font-black text-orange-500">{Number(profile.rating).toFixed(3)}</p>
            </div>
          </div>

          {currentUser && currentUser.id !== profile.id && (
            <div className="mt-8 pt-6 border-t border-zinc-800">
              {isFriend ? (
                <button disabled className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-6 py-3 rounded-xl font-bold cursor-not-allowed w-full md:w-auto">{t('profile.onFriendsList')}</button>
              ) : (
                <button onClick={handleAddFriend} className="bg-orange-600 text-white font-extrabold px-6 py-3 rounded-xl hover:bg-orange-500 transition shadow-lg shadow-orange-900/50 w-full md:w-auto">{t('profile.addFriend')}</button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-800 text-center">
            <p className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase mb-1 truncate">{t('profile.totalMatches')}</p>
            <p className="text-2xl md:text-3xl font-black text-white">{stats.total}</p>
          </div>
          <div className="bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-800 text-center">
            <p className="text-[10px] md:text-xs text-green-500 font-bold uppercase mb-1 truncate">{t('profile.wins')}</p>
            <p className="text-2xl md:text-3xl font-black text-green-400">{stats.wins}</p>
          </div>
          <div className="bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-800 text-center">
            <p className="text-[10px] md:text-xs text-red-500 font-bold uppercase mb-1 truncate">{t('profile.losses')}</p>
            <p className="text-2xl md:text-3xl font-black text-red-400">{stats.losses}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* TABBED RECENT FORM */}
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h3 className="text-xl font-bold text-white">{t('dashboard.recentForm')}</h3>
              
              <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800 w-full sm:w-auto">
                <button onClick={() => setMatchTab('1v1')} className={`flex-1 sm:px-4 py-1.5 rounded font-bold text-xs transition ${matchTab === '1v1' ? 'bg-zinc-800 text-orange-500 shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.singles')}</button>
                <button onClick={() => setMatchTab('2v2')} className={`flex-1 sm:px-4 py-1.5 rounded font-bold text-xs transition ${matchTab === '2v2' ? 'bg-zinc-800 text-blue-400 shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.doubles')}</button>
              </div>
            </div>

            {displayMatches.length === 0 ? <p className="text-zinc-500">{matchTab === '1v1' ? t('profile.noSingles') : t('profile.noDoubles')}</p> : (
              <div className="space-y-3">
                {displayMatches.map((match) => {
                  const isTeamA = match.player_a_id === profile.id || match.team_a_player2_id === profile.id;
                  const teamAWon = match.player_a_score > match.player_b_score;
                  const isWin = (isTeamA && teamAWon) || (!isTeamA && !teamAWon);
                  
                  return (
                    <div key={match.id} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-700 transition">
                      <div className="flex items-center gap-4">
                        <span className={`px-2 py-1.5 text-[10px] font-black rounded-lg tracking-wider ${isWin ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {isWin ? t('common.win') : t('common.loss')}
                        </span>
                        <div>
                          <span className="text-base font-extrabold text-zinc-200 block">
                            {match.player_a_score} - {match.player_b_score}
                          </span>
                          <span className="text-xs text-zinc-500 font-medium block">
                            {new Date(match.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-black uppercase rounded px-2 py-1 border ${match.match_type === '2v2' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                          {match.match_type === '2v2' ? t('common.doubles') : t('common.singles')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FRIENDS ROSTER */}
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6">{t('profile.friendsRoster')}</h3>
            {friends.length === 0 ? <p className="text-zinc-500">{t('friends.noFriends')}</p> : (
              <div className="space-y-3">
                {friends.map((friend) => (
                  <Link href={`/profile/${friend.profile_hash}`} key={friend.id} className="flex justify-between items-center p-4 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-orange-500 transition group">
                    <span className="font-bold text-zinc-300 group-hover:text-orange-400 transition truncate pr-2">{formatName(friend.email)}</span>
                    <span className="bg-orange-500/10 text-orange-400 font-bold px-2 py-1 rounded text-xs whitespace-nowrap">{Number(friend.rating).toFixed(3)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}