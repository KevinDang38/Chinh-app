"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../context/LanguageContext";
import { Activity, Flame, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// --- HELPER FUNCTION ---
const getInitials = (email) => {
  if (!email) return 'ME';
  return email.substring(0, 2).toUpperCase();
};

export default function Dashboard() {
  const { t, language } = useLanguage();
  const router = useRouter();
  
  const [matchTab, setMatchTab] = useState('1v1');

  // --- 1. SWR FETCHING ---
  const fetcher = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      throw new Error("Unauthorized");
    }
    const userId = session.user.id;

    const [profileRes, matchesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('matches')
        .select('*')
        .or(`player_a_id.eq.${userId},team_a_player2_id.eq.${userId},team_b_player1_id.eq.${userId},team_b_player2_id.eq.${userId}`)
        .order('created_at', { ascending: true }) // Fetch oldest to newest for the chart
    ]);

    return { 
      user: session.user, 
      profile: profileRes.data, 
      matches: matchesRes.data || [] 
    };
  };

  const { data, isLoading } = useSWR("user-dashboard", fetcher);

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-bold text-zinc-500 bg-[#050507]">
      <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
      {t('common.loading') || 'Loading...'}
    </div>
  );

  if (!data) return null;

  const { user, profile, matches } = data;

  // --- 2. DATA PROCESSING ---
  let wins = 0;
  let losses = 0;
  let chartData = [];
  
  // Reconstruct rating history working backwards from current rating
  let runningRating = Number(profile?.rating || 3.5);
  const reversedMatches = [...matches].reverse(); // Newest to oldest to subtract history
  const historicalRatings = [];

  const singlesMatches = [];
  const doublesMatches = [];

  reversedMatches.forEach((match) => {
    historicalRatings.push(runningRating);
    
    // Determine team and win/loss
    const isTeamA = match.player_a_id === user.id || match.team_a_player2_id === user.id;
    const teamAScore = match.player_a_score;
    const teamBScore = match.player_b_score;
    
    const wonMatch = isTeamA ? teamAScore > teamBScore : teamBScore > teamAScore;
    if (wonMatch) wins++;
    else losses++;

    // Group for the recent matches tabs
    if (match.match_type === '2v2') doublesMatches.push(match);
    else singlesMatches.push(match);

    // Approximate previous rating (simplified reverse K-factor)
    const ratingChange = match.rating_change || 0.05; 
    runningRating = wonMatch ? runningRating - ratingChange : runningRating + ratingChange;
  });

  // Build the array for Recharts (Oldest to Newest)
  historicalRatings.reverse();
  let lastDateStr = "";

  matches.forEach((match, index) => {
    const fullDate = new Date(match.created_at).toLocaleDateString(language || 'en', { month: 'short', day: 'numeric' });
    
    let displayDate = "";
    if (fullDate !== lastDateStr) {
      displayDate = fullDate;
      lastDateStr = fullDate;
    }

    chartData.push({
      name: fullDate,
      displayDate: displayDate,
      rating: Number(historicalRatings[index].toFixed(3)),
      score: `${match.player_a_score} - ${match.player_b_score}`
    });
  });

  if (chartData.length === 0) {
    chartData.push({ name: t('dashboard.start') || 'Start', displayDate: t('dashboard.start') || 'Start', rating: Number(profile?.rating || 3.5).toFixed(3) });
  }

  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const displayMatches = (matchTab === '1v1' ? singlesMatches : doublesMatches).slice(0, 5);

  // --- 3. CHART TOOLTIP ---
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const pData = payload[0].payload;
      return (
        <div className="bg-[#0a0a0c] border border-white/10 p-3 rounded-xl shadow-xl">
          <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">{pData.name}</p>
          <p className="text-orange-400 font-black text-lg">{payload[0].value.toFixed(3)}</p>
          {pData.score && (
            <p className="text-zinc-500 text-xs font-bold mt-1">{t('dashboard.score') || 'Score'}: {pData.score}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <main 
      className="min-h-screen px-4 py-6 md:p-8 w-full pb-24 overflow-y-auto overflow-x-hidden touch-pan-y bg-[#050507]" 
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        
        {/* PREMIUM HEADER */}
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
        <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden group border border-white/5 bg-linear-to-br from-white/3 to-transparent shadow-2xl">
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
            <div className="glass-card bg-black/40 border border-white/5 px-5 sm:px-6 py-4 rounded-2xl w-full md:w-auto flex items-center justify-between md:justify-start gap-4 sm:gap-8">
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
                <p className="text-xl sm:text-2xl font-black text-white">{totalMatches}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2-COLUMN STATS GRID */}
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card bg-[#0a0a0c] border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:bg-white/5 transition-colors">
            <div className="p-2 sm:p-3 bg-green-500/10 rounded-xl shrink-0"><TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-zinc-500 font-bold uppercase">{t('profile.wins') || 'Wins'}</p>
              <p className="text-lg sm:text-xl font-black text-white">{wins}</p>
            </div>
          </div>
          <div className="glass-card bg-[#0a0a0c] border border-white/5 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:bg-white/5 transition-colors">
            <div className="p-2 sm:p-3 bg-red-500/10 rounded-xl shrink-0"><Flame className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-zinc-500 font-bold uppercase">{t('profile.losses') || 'Losses'}</p>
              <p className="text-lg sm:text-xl font-black text-white">{losses}</p>
            </div>
          </div>
        </div>

        {/* RATING HISTORY CHART */}
        <div className="glass-panel p-5 sm:p-8 rounded-4xl border border-white/5 bg-linear-to-b from-white/3 to-transparent">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" /> {t("dashboard.performanceHistory") || "Performance History"}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">{t("dashboard.performanceHistorySub") || "Your rating trajectory over recorded matches."}</p>
            </div>
          </div>

          <div className="h-75 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.05} vertical={false} />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                <YAxis 
                  domain={['dataMin - 0.1', 'dataMax + 0.1']} 
                  stroke="#52525b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => val.toFixed(2)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="rating" 
                  stroke="#f97316" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRating)" 
                  activeDot={{ r: 6, fill: "#f97316", stroke: "#000", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* RECENT MATCHES SECTION */}
        <div className="glass-panel p-5 sm:p-8 rounded-3xl border border-white/5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              {t('dashboard.recentForm') || 'Recent Form'}
            </h3>
            
            {/* Premium Pill Tabs */}
            <div className="flex glass-card rounded-xl p-1 w-full sm:w-48 relative border border-white/5 bg-black/40">
              <button onClick={() => setMatchTab('1v1')} className={`flex-1 py-2 sm:py-1.5 rounded-lg font-bold text-[10px] sm:text-xs transition-all z-10 ${matchTab === '1v1' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.singles') || 'Singles'}</button>
              <button onClick={() => setMatchTab('2v2')} className={`flex-1 py-2 sm:py-1.5 rounded-lg font-bold text-[10px] sm:text-xs transition-all z-10 ${matchTab === '2v2' ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}>{t('common.doubles') || 'Doubles'}</button>
            </div>
          </div>
          
          {displayMatches.length === 0 ? (
            <div className="py-8 sm:py-12 text-center border border-dashed border-white/10 rounded-2xl bg-black/20">
              <p className="text-zinc-500 text-xs sm:text-sm font-medium">{matchTab === '1v1' ? (t('dashboard.noSingles') || 'No Singles Matches') : (t('dashboard.noDoubles') || 'No Doubles Matches')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayMatches.map((match) => {
                const isTeamA = match.player_a_id === user.id || match.team_a_player2_id === user.id;
                const teamAWon = match.player_a_score > match.player_b_score;
                const isWin = (isTeamA && teamAWon) || (!isTeamA && !teamAWon);

                return (
                  <div key={match.id} className="group flex items-center justify-between p-3 sm:p-4 bg-[#0a0a0c] hover:bg-white/5 border border-white/5 rounded-2xl transition-all duration-300">
                    <div className="flex items-center gap-3 sm:gap-5">
                      <div className={`w-1.5 h-8 sm:h-10 rounded-full shrink-0 ${isWin ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}></div>
                      <div>
                        <span className="text-lg sm:text-xl font-black text-white block tracking-wide whitespace-nowrap">
                          {isTeamA ? `${match.player_a_score} - ${match.player_b_score}` : `${match.player_b_score} - ${match.player_a_score}`}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">
                          {new Date(match.created_at).toLocaleDateString(language || 'en', { month: 'short', day: 'numeric', year: 'numeric' })}
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