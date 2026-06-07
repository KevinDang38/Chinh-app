"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../context/LanguageContext";

export default function Dashboard() {
  const { t } = useLanguage();
  
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  
  const [singlesMatches, setSinglesMatches] = useState([]);
  const [doublesMatches, setDoublesMatches] = useState([]);
  const [matchTab, setMatchTab] = useState('1v1');
  const [stats, setStats] = useState({ wins: 0, losses: 0, total: 0 });

  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchSessionAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      
      setUser(session.user);
      await Promise.all([
        fetchProfile(session.user.id),
        fetchMatches(session.user.id)
      ]);
      setLoading(false);
    };
    fetchSessionAndData();
  }, [router]);

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) setProfile(data);
  };

  const fetchMatches = async (userId) => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .or(`player_a_id.eq.${userId},team_a_player2_id.eq.${userId},team_b_player1_id.eq.${userId},team_b_player2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (data) {
      setSinglesMatches(data.filter(m => m.match_type !== '2v2'));
      setDoublesMatches(data.filter(m => m.match_type === '2v2'));
      
      // Calculate Stats
      let wins = 0;
      let losses = 0;
      data.forEach(m => {
        const isTeamA = m.player_a_id === userId || m.team_a_player2_id === userId;
        const teamAWon = m.player_a_score > m.player_b_score;
        if ((isTeamA && teamAWon) || (!isTeamA && !teamAWon)) wins++;
        else losses++;
      });
      setStats({ wins, losses, total: data.length });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black font-bold text-zinc-500">{t('common.loading')}</div>;

  const displayMatches = (matchTab === '1v1' ? singlesMatches : doublesMatches).slice(0, 5);

  return (
    <main className="min-h-screen bg-black p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 border-b border-zinc-800 pb-4">
          <h1 className="text-3xl font-extrabold text-white">{t('dashboard.title')}</h1>
        </div>

        {/* PROFILE & DUPR SECTION */}
        <div className="bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-800 mb-8 border-t-4 border-t-orange-500">
          <h2 className="text-2xl font-bold text-white mb-1">{t('dashboard.welcome')}</h2>
          <p className="text-zinc-400 mb-8">{user?.email}</p>

          <div className="bg-zinc-950 p-8 rounded-2xl text-center border border-zinc-800 shadow-inner">
            <p className="text-sm text-orange-400 font-bold uppercase tracking-widest mb-2">{t('dashboard.officialRating')}</p>
            <p className="text-7xl font-black text-orange-500 drop-shadow-sm tracking-tighter">
              {profile?.rating ? Number(profile.rating).toFixed(3) : "3.500"}
            </p>
          </div>
        </div>

        {/* STAT CARDS (Moved from Profile) */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800 text-center">
            <p className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase mb-1">{t('profile.totalMatches')}</p>
            <p className="text-2xl md:text-3xl font-black text-white">{stats.total}</p>
          </div>
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800 text-center">
            <p className="text-[10px] md:text-xs text-green-500 font-bold uppercase mb-1">{t('profile.wins')}</p>
            <p className="text-2xl md:text-3xl font-black text-green-400">{stats.wins}</p>
          </div>
          <div className="bg-zinc-900 p-4 md:p-6 rounded-2xl border border-zinc-800 text-center">
            <p className="text-[10px] md:text-xs text-red-500 font-bold uppercase mb-1">{t('profile.losses')}</p>
            <p className="text-2xl md:text-3xl font-black text-red-400">{stats.losses}</p>
          </div>
        </div>
        
        {/* RECENT MATCHES */}
        <div className="bg-zinc-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-zinc-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-xl font-bold text-white">{t('dashboard.recentForm')}</h3>
            
            <div className="flex bg-zinc-950 rounded-lg p-1 border border-zinc-800 w-full sm:w-48">
              <button onClick={() => setMatchTab('1v1')} className={`flex-1 py-1.5 rounded font-bold text-xs transition ${matchTab === '1v1' ? 'bg-zinc-800 text-orange-500 shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.singles')}</button>
              <button onClick={() => setMatchTab('2v2')} className={`flex-1 py-1.5 rounded font-bold text-xs transition ${matchTab === '2v2' ? 'bg-zinc-800 text-blue-400 shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.doubles')}</button>
            </div>
          </div>
          
          {displayMatches.length === 0 ? (
            <p className="text-zinc-500 py-4">{matchTab === '1v1' ? t('dashboard.noSingles') : t('dashboard.noDoubles')}</p>
          ) : (
            <div className="space-y-3">
              {displayMatches.map((match) => {
                const isTeamA = match.player_a_id === user.id || match.team_a_player2_id === user.id;
                const teamAWon = match.player_a_score > match.player_b_score;
                const isWin = (isTeamA && teamAWon) || (!isTeamA && !teamAWon);

                return (
                  <div key={match.id} className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition">
                    <div className="flex items-center gap-4">
                      <span className={`px-3 py-2 text-xs font-black rounded-lg tracking-wider ${isWin ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                        {isWin ? t('common.win') : t('common.loss')}
                      </span>
                      <div>
                        <span className="text-lg font-extrabold text-zinc-200 block">
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
      </div>
    </main>
  );
}