"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../context/LanguageContext";
import { Activity, Flame, TrendingUp } from "lucide-react";

// --- HELPER FUNCTION ---
const getInitials = (email) => {
  if (!email) return 'ME';
  return email.substring(0, 2).toUpperCase();
};

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

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-bold text-zinc-500">
      <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
      {t('common.loading') || 'Loading...'}
    </div>
  );

  const displayMatches = (matchTab === '1v1' ? singlesMatches : doublesMatches).slice(0, 5);
  const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;

  return (
    <main 
      className="min-h-screen px-4 py-6 md:p-8 w-full pb-24 overflow-y-auto overflow-x-hidden touch-pan-y" 
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        
        {/* PREMIUM HEADER: Top-Right Profile Pill (Hidden on Mobile) */}
        <div className="hidden md:flex justify-end px-2 mb-4 md:mb-6">
          <div className="glass-card flex items-center gap-3 pl-4 pr-2 py-1.5 rounded-full shadow-md border border-white/5 bg-black/20">
            <span className="text-zinc-400 text-xs sm:text-sm font-medium tracking-wide truncate max-w-35 sm:max-w-50">
              {user?.email}
            </span>
            <div className="w-8 h-8 shrink-0 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400 font-black text-[10px] shadow-[0_0_10px_rgba(234,88,12,0.2)]">
              {getInitials(user?.email)}
            </div>
          </div>
        </div>

        {/* HERO DUPR CARD */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-orange-500/20 transition-all duration-700"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="w-full">
              <p className="text-[10px] sm:text-xs text-orange-500 font-bold uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                {t('dashboard.officialRating') || 'Your Official DUPR Rating'}
              </p>
              <p className="text-6xl sm:text-7xl md:text-8xl font-black text-transparent bg-clip-text bg-linear-to-br from-white via-white to-zinc-500 drop-shadow-sm tracking-tighter mb-4 md:mb-0">
                {profile?.rating ? Number(profile.rating).toFixed(3) : "3.500"}
              </p>
            </div>
            
            {/* Quick Stats Summary */}
            <div className="glass-card px-5 sm:px-6 py-4 rounded-2xl w-full md:w-auto flex items-center justify-between md:justify-start gap-4 sm:gap-8">
              <div className="flex-1 md:flex-none">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 whitespace-nowrap">
                  {t('dashboard.winRate') || 'Win Rate'}
                </p>
                <p className="text-xl sm:text-2xl font-black text-white">{winRate}%</p>
              </div>
              <div className="w-px h-10 bg-white/10 hidden sm:block"></div>
              <div className="flex-1 md:flex-none text-right md:text-left">
                <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 whitespace-nowrap">
                  {t('dashboard.matches') || 'Matches'}
                </p>
                <p className="text-xl sm:text-2xl font-black text-white">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2-COLUMN STATS GRID */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-green-500/10 rounded-xl shrink-0"><TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-zinc-500 font-bold uppercase">{t('profile.wins') || 'Wins'}</p>
              <p className="text-lg sm:text-xl font-black text-white">{stats.wins}</p>
            </div>
          </div>
          <div className="glass-card p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="p-2 sm:p-3 bg-red-500/10 rounded-xl shrink-0"><Flame className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-zinc-500 font-bold uppercase">{t('profile.losses') || 'Losses'}</p>
              <p className="text-lg sm:text-xl font-black text-white">{stats.losses}</p>
            </div>
          </div>
        </div>
        
        {/* RECENT MATCHES SECTION */}
        <div className="glass-panel p-5 sm:p-8 rounded-3xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              {t('dashboard.recentForm') || 'Recent Form'}
            </h3>
            
            {/* Premium Pill Tabs */}
            <div className="flex glass-card rounded-xl p-1 w-full sm:w-48 relative">
              <button onClick={() => setMatchTab('1v1')} className={`flex-1 py-2 sm:py-1.5 rounded-lg font-bold text-[10px] sm:text-xs transition-all z-10 ${matchTab === '1v1' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.singles') || 'Singles'}</button>
              <button onClick={() => setMatchTab('2v2')} className={`flex-1 py-2 sm:py-1.5 rounded-lg font-bold text-[10px] sm:text-xs transition-all z-10 ${matchTab === '2v2' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.doubles') || 'Doubles'}</button>
            </div>
          </div>
          
          {displayMatches.length === 0 ? (
            <div className="py-8 sm:py-12 text-center border border-dashed border-white/5 rounded-2xl">
              <p className="text-zinc-500 text-xs sm:text-sm font-medium">{matchTab === '1v1' ? (t('dashboard.noSingles') || 'No Singles Matches') : (t('dashboard.noDoubles') || 'No Doubles Matches')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayMatches.map((match) => {
                const isTeamA = match.player_a_id === user.id || match.team_a_player2_id === user.id;
                const teamAWon = match.player_a_score > match.player_b_score;
                const isWin = (isTeamA && teamAWon) || (!isTeamA && !teamAWon);

                return (
                  <div key={match.id} className="group flex items-center justify-between p-3 sm:p-4 glass-card hover:bg-white/2 rounded-2xl transition-all duration-300">
                    <div className="flex items-center gap-3 sm:gap-5">
                      <div className={`w-1.5 h-8 sm:h-10 rounded-full shrink-0 ${isWin ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}></div>
                      <div>
                        <span className="text-lg sm:text-xl font-black text-white block tracking-wide whitespace-nowrap">
                          {match.player_a_score} <span className="text-zinc-600 font-normal mx-0.5 sm:mx-1">-</span> {match.player_b_score}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">
                          {new Date(match.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[9px] sm:text-[10px] font-black uppercase rounded-lg px-2 sm:px-3 py-1.5 border ${isWin ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {isWin ? (t('common.win') || 'Win') : (t('common.loss') || 'Loss')}
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