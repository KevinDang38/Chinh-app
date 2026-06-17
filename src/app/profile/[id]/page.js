"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "../../../context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Activity, Trophy, ShieldAlert, Users } from "lucide-react";

const getInitials = (email) => {
  if (!email) return '?';
  return email.substring(0, 2).toUpperCase();
};

export default function UserProfile() {
  const { id } = useParams(); 
  const router = useRouter();
  const { t } = useLanguage();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  
  const [singlesMatches, setSinglesMatches] = useState([]);
  const [doublesMatches, setDoublesMatches] = useState([]);
  const [matchTab, setMatchTab] = useState('1v1');

  const [friends, setFriends] = useState([]);
  const [isFriend, setIsFriend] = useState(false);
  const [stats, setStats] = useState({ wins: 0, losses: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  const formatName = (email) => email ? email.split('@')[0] : (t('common.guest') || 'Guest');

  useEffect(() => {
    const fetchAllData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      const { data: profileData } = await supabase.from('profiles').select('*').eq('profile_hash', id).single();
      if (!profileData) return router.push("/dashboard");
      setProfile(profileData);

      const targetUserId = profileData.id; 

      if (session) {
        const { data: check1 } = await supabase.from('friends').select('*').eq('user_id', session.user.id).eq('friend_id', targetUserId).single();
        const { data: check2 } = await supabase.from('friends').select('*').eq('user_id', targetUserId).eq('friend_id', session.user.id).single();
        if (check1 || check2) setIsFriend(true);
      }

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

      const { data: matchData } = await supabase
        .from('matches')
        .select('*')
        .or(`player_a_id.eq.${targetUserId},team_a_player2_id.eq.${targetUserId},team_b_player1_id.eq.${targetUserId},team_b_player2_id.eq.${targetUserId}`)
        .order('created_at', { ascending: false });

      if (matchData) {
        setSinglesMatches(matchData.filter(m => m.match_type !== '2v2'));
        setDoublesMatches(matchData.filter(m => m.match_type === '2v2'));
        
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
    if (!currentUser) return alert(t('profile.loginToAdd') || "Log in to add friends!");
    const { error } = await supabase.from('friends').insert([{ user_id: currentUser.id, friend_id: profile.id }]);
    if (error) alert("Error: " + error.message);
    else {
      setIsFriend(true);
      alert(t('profile.friendAdded') || "Friend added!");
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-bold text-zinc-500 bg-[#050507]">
      <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
      {t('common.loading') || 'Loading profile...'}
    </div>
  );

  const displayMatches = (matchTab === '1v1' ? singlesMatches : doublesMatches).slice(0, 5);

  return (
    <main 
      className="min-h-screen px-4 py-6 md:p-8 w-full pb-24 overflow-y-auto overflow-x-hidden touch-pan-y bg-[#050507]"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-4xl mx-auto space-y-6"
      >
        
        <div className="glass-panel p-6 sm:p-8 rounded-4xl relative overflow-hidden shadow-2xl group border border-white/5">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-[80px] -mr-10 -mt-10 pointer-events-none group-hover:bg-orange-500/20 transition-all duration-700"></div>
          
          <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-6">
            
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left w-full sm:w-auto">
              <div className="w-20 h-20 shrink-0 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center font-black text-2xl text-zinc-400 shadow-inner backdrop-blur-md">
                {getInitials(profile.email)}
              </div>
              
              <div className="flex flex-col items-center sm:items-start justify-center">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-1.5 truncate tracking-tight">
                  {formatName(profile.email)}
                </h1>
                
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <p className="text-xs font-bold text-zinc-500 flex items-center gap-2">
                    <span className="uppercase tracking-wider text-[9px] bg-white/5 px-2 py-0.5 rounded border border-white/10">ID</span> 
                    {profile.profile_hash}
                  </p>

                  {currentUser && currentUser.id !== profile.id && (
                    <>
                      <span className="hidden sm:inline text-zinc-700 font-black">•</span>
                      <div>
                        {isFriend ? (
                          <div className="bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-lg inline-flex items-center cursor-default">
                            <span className="text-[10px] font-bold text-green-400 tracking-wide uppercase">
                              {t('profile.onFriendsList') || '✓ Friends'}
                            </span>
                          </div>
                        ) : (
                          <button onClick={handleAddFriend} className="bg-white/5 text-white border border-white/10 font-bold h-8 px-4 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-xs">
                            {t('profile.addFriend') || '➕ Add Friend'}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-center sm:text-right w-full sm:w-auto glass-card sm:bg-transparent p-4 sm:p-0 rounded-xl border border-white/5 sm:border-none self-center">
              <p className="text-[9px] text-orange-400 font-bold uppercase tracking-widest mb-1">{t('profile.duprRating') || 'DUPR Rating'}</p>
              <p className="text-4xl font-black text-orange-500 drop-shadow-md">{Number(profile.rating).toFixed(3)}</p>
            </div>
            
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card bg-white/2 p-4 rounded-2xl border border-white/5 text-center shadow-inner hover:bg-white/4 transition-colors">
            <Activity className="w-5 h-5 text-zinc-500 mx-auto mb-2 opacity-50" />
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mb-1 truncate">{t('profile.totalMatches') || 'Total Matches'}</p>
            <p className="text-2xl font-black text-white">{stats.total}</p>
          </div>
          <div className="glass-card bg-green-500/2 p-4 rounded-2xl border border-green-500/10 text-center shadow-inner hover:bg-green-500/4 transition-colors">
            <Trophy className="w-5 h-5 text-green-500 mx-auto mb-2 opacity-50" />
            <p className="text-[9px] text-green-500 font-bold uppercase tracking-widest mb-1 truncate">{t('profile.wins') || 'Wins'}</p>
            <p className="text-2xl font-black text-green-400">{stats.wins}</p>
          </div>
          <div className="glass-card bg-red-500/2 p-4 rounded-2xl border border-red-500/10 text-center shadow-inner hover:bg-red-500/4 transition-colors">
            <ShieldAlert className="w-5 h-5 text-red-500 mx-auto mb-2 opacity-50" />
            <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest mb-1 truncate">{t('profile.losses') || 'Losses'}</p>
            <p className="text-2xl font-black text-red-400">{stats.losses}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="glass-panel p-5 rounded-3xl relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-500" /> {t('dashboard.recentForm') || 'Recent Form'}
              </h3>
              
              <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 w-full sm:w-auto h-10">
                {['1v1', '2v2'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setMatchTab(tab)}
                    className={`relative flex-1 sm:min-w-20 px-3 rounded-lg font-bold text-xs outline-none transition-colors duration-300 whitespace-nowrap ${
                      matchTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {matchTab === tab && (
                      <motion.div
                        layoutId="profileMatchTab"
                        className="absolute inset-0 bg-white/10 rounded-lg shadow-md border border-white/10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 tracking-wider">
                      {tab === '1v1' ? (t('common.singles') || 'Singles') : (t('common.doubles') || 'Doubles')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="relative min-h-50">
              <AnimatePresence mode="wait">
                <motion.div
                  key={matchTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {displayMatches.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-white/5 rounded-xl bg-white/1">
                      <p className="text-zinc-500 text-xs font-medium">
                        {matchTab === '1v1' ? (t('profile.noSingles') || 'No Singles matches.') : (t('profile.noDoubles') || 'No Doubles matches.')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {displayMatches.map((match) => {
                        const isTeamA = match.player_a_id === profile.id || match.team_a_player2_id === profile.id;
                        const teamAWon = match.player_a_score > match.player_b_score;
                        const isWin = (isTeamA && teamAWon) || (!isTeamA && !teamAWon);
                        
                        return (
                          <div key={match.id} className="group flex items-center justify-between p-3.5 bg-black/20 border border-white/5 rounded-xl hover:bg-white/2 transition-colors shadow-inner">
                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-1 text-[9px] font-black rounded-md tracking-widest ${isWin ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {isWin ? (t('common.win') || 'WIN') : (t('common.loss') || 'LOSS')}
                              </span>
                              <div>
                                <span className="text-sm font-extrabold text-white block tracking-wide">
                                  {match.player_a_score} - {match.player_b_score}
                                </span>
                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">
                                  {new Date(match.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-[8px] font-black uppercase tracking-widest rounded px-2 py-1 border ${match.match_type === '2v2' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                                {match.match_type === '2v2' ? (t('common.doubles') || 'Doubles') : (t('common.singles') || 'Singles')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="glass-panel p-5 rounded-3xl">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-500" /> {t('profile.friendsRoster') || 'Friends Roster'}
            </h3>
            
            {friends.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-white/5 rounded-xl bg-white/1">
                <p className="text-zinc-500 text-xs font-medium">{t('friends.noFriends') || 'No friends added yet.'}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {friends.map((friend) => (
                  <Link href={`/profile/${friend.profile_hash}`} key={friend.id} className="group flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5 hover:bg-white/2 hover:border-orange-500/30 transition-all shadow-inner cursor-pointer">
                    
                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                      <div className="w-8 h-8 shrink-0 rounded-full bg-black border border-white/10 flex items-center justify-center font-black text-[10px] text-zinc-400 shadow-inner group-hover:border-orange-500/50 group-hover:text-orange-400 transition-colors">
                        {getInitials(friend.email)}
                      </div>
                      <span className="font-bold text-sm text-zinc-300 group-hover:text-white transition-colors truncate">
                        {formatName(friend.email)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold px-2 py-0.5 rounded text-[10px]">
                        {Number(friend.rating).toFixed(3)}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-orange-500 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </motion.div>
    </main>
  );
}