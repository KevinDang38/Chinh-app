"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient"; 
import { useParams, useRouter } from "next/navigation";
import { generateTournamentBracket } from "../../../../lib/tournamentLogic";
import { SingleEliminationBracket, Match, createTheme } from '@g-loot/react-tournament-brackets';

const myDarkTheme = createTheme({
  textColor: { main: '#ffffff', highlighted: '#ea580c', dark: '#a1a1aa' },
  matchBackground: { wonColor: '#18181b', lostColor: '#18181b' },
  score: { background: { wonColor: '#ea580c', lostColor: '#27272a' }, text: { wonColor: '#ffffff', lostColor: '#ffffff' } },
  border: { color: '#27272a', highlightedColor: '#ea580c' },
  roundHeader: { backgroundColor: '#ea580c', fontColor: '#ffffff' },
  connectorColor: '#3f3f46', connectorColorHighlight: '#ea580c', svgBackground: '#09090b',
});

export default function ManageEvent() {
  const { id } = useParams();
  const router = useRouter();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [realBracketData, setRealBracketData] = useState([]);
  const [totalRealRounds, setTotalRealRounds] = useState(1);
  const [bracketViewMode, setBracketViewMode] = useState('rounds'); 
  const [selectedRound, setSelectedRound] = useState(1);

  const [scoreModal, setScoreModal] = useState({ isOpen: false, match: null, scoreA: '', scoreB: '' });
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);

  const fetchEventDetails = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return router.push("/login");

    const { data: eventData } = await supabase.from('events').select('*').eq('id', id).single();
    if (!eventData || eventData.creator_id !== session.user.id) {
        alert("You are not authorized to view the secure manager dashboard.");
        return router.push("/events");
    }
    setEvent(eventData);

    if (eventData.event_category === 'single_elimination') {
      const { data: matchNodes } = await supabase.from('tournament_matches').select(`*, player_a:player_a_id(email), player_b:team_b_player1_id(email)`).eq('event_id', id).order('round_number', { ascending: false });

      if (matchNodes && matchNodes.length > 0) {
        const formattedNodes = matchNodes.map(m => ({
          id: m.id, nextMatchId: m.next_match_id, tournamentRoundText: `${m.round_number}`, roundNumber: m.round_number, state: m.status === 'completed' ? 'DONE' : 'SCHEDULED',
          participants: [
            { id: m.player_a_id || `tbd-a-${m.id}`, name: m.player_a?.email ? m.player_a.email.split('@')[0] : 'TBD', isWinner: m.winner_team === 'team_a', score: m.player_a_score },
            { id: m.team_b_player1_id || `tbd-b-${m.id}`, name: m.player_b?.email ? m.player_b.email.split('@')[0] : 'TBD', isWinner: m.winner_team === 'team_b', score: m.player_b_score }
          ]
        }));
        setRealBracketData(formattedNodes);
        setTotalRealRounds(Math.max(...formattedNodes.map(n => n.roundNumber)));
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchEventDetails(); }, [id, router]);

  const handleRunEngine = async () => {
    try {
        await generateTournamentBracket(event.id, event.event_category);
        alert("Math Engine Complete! The bracket is now live.");
        fetchEventDetails();
    } catch (e) {
        alert(e.message);
    }
  }

  const handleCompleteTournament = async () => {
    if(!confirm("Are you sure you want to end this tournament? This will freeze the bracket permanently.")) return;
    await supabase.from('events').update({ event_status: 'completed' }).eq('id', id);
    alert("Tournament officially completed!");
    fetchEventDetails();
  }

  const handleScoreSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingScore(true);
    
    const { match, scoreA, scoreB } = scoreModal;
    const sA = parseInt(scoreA);
    const sB = parseInt(scoreB);
    const winnerTeam = sA > sB ? 'team_a' : 'team_b';
    const winnerId = winnerTeam === 'team_a' ? match.participants[0].id : match.participants[1].id;

    await supabase.from('tournament_matches').update({ player_a_score: sA, player_b_score: sB, winner_team: winnerTeam, status: 'completed' }).eq('id', match.id);

    if (match.nextMatchId) {
      const { data: nextMatch } = await supabase.from('tournament_matches').select('*').eq('id', match.nextMatchId).single();
      if (nextMatch) {
        if (!nextMatch.player_a_id) await supabase.from('tournament_matches').update({ player_a_id: winnerId }).eq('id', match.nextMatchId);
        else await supabase.from('tournament_matches').update({ team_b_player1_id: winnerId }).eq('id', match.nextMatchId);
      }
    }
    setScoreModal({ isOpen: false, match: null, scoreA: '', scoreB: '' });
    await fetchEventDetails(); 
    setIsSubmittingScore(false);
  };

  if (loading) return <div className="min-h-screen bg-[#050507] text-white flex justify-center items-center">Loading Secure Manager...</div>;

  const isTournamentFinished = event.event_status === 'completed';

  return (
    <main className="min-h-screen bg-[#050507] p-4 md:p-8 w-full overflow-hidden relative">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        
        {/* DASHBOARD HEADER */}
        <div className="bg-[#0a0a0c] p-6 rounded-2xl border border-white/5 mb-6 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">Secure Director Dashboard</h1>
            <div className="flex items-center gap-2">
              <p className="text-orange-500 font-bold text-sm">{event.title}</p>
              {isTournamentFinished && <span className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded font-black tracking-widest uppercase">COMPLETED</span>}
            </div>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            {event.event_status === 'live' && (
              <button onClick={handleCompleteTournament} className="h-12 bg-red-500/10 text-red-500 border border-red-500/20 px-6 rounded-xl font-bold text-sm transition hover:bg-red-500 hover:text-white w-full md:w-auto">
                End Tournament
              </button>
            )}
            <button onClick={() => router.push(`/events/${id}`)} className="h-12 bg-zinc-800 text-white px-6 rounded-xl font-bold text-sm transition hover:bg-zinc-700 w-full md:w-auto">
              Exit to Public
            </button>
          </div>
        </div>

        {realBracketData.length === 0 ? (
            <div className="bg-[#0a0a0c] p-10 rounded-2xl border border-white/5 text-center shadow-xl">
                <h2 className="text-xl font-black text-white mb-2">Bracket Not Generated Yet</h2>
                <p className="text-sm text-zinc-400 mb-6">Run the math engine to automatically pair players based on the locked seeds.</p>
                <button onClick={handleRunEngine} className="h-12 bg-orange-600 text-white font-bold text-base px-8 rounded-xl hover:bg-orange-500 shadow-[0_8px_20px_rgba(234,88,12,0.25)]">Run Math Engine & Generate Bracket</button>
            </div>
        ) : (
            <div className="flex-1 flex flex-col h-full w-full">
            <div className="flex bg-black/40 rounded-xl p-1 mb-5 border border-white/5 w-fit">
                <button onClick={() => setBracketViewMode('rounds')} className={`px-5 h-10 rounded-lg font-bold text-xs transition-colors ${bracketViewMode === 'rounds' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>📋 Tabbed Input View</button>
                <button onClick={() => setBracketViewMode('tree')} className={`px-5 h-10 rounded-lg font-bold text-xs transition-colors ${bracketViewMode === 'tree' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>🌳 Visual Tree</button>
            </div>

            {bracketViewMode === 'tree' ? (
                <div className="flex-1 bg-black/40 rounded-2xl border border-white/5 overflow-auto relative min-h-125 p-6 custom-scrollbar shadow-inner">
                <div className="inline-block" style={{ minWidth: '1200px' }}>
                    <SingleEliminationBracket matches={realBracketData} matchComponent={Match} theme={myDarkTheme} />
                </div>
                </div>
            ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex gap-2 overflow-x-auto pb-4 mb-2 border-b border-white/5 custom-scrollbar">
                    {Array.from({ length: totalRealRounds }).map((_, i) => (
                    <button key={i+1} onClick={() => setSelectedRound(i+1)} className={`px-5 h-10 rounded-lg font-bold text-xs transition-all border ${selectedRound === i+1 ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-black/40 text-zinc-400 border-white/10 hover:text-white hover:bg-white/10'}`}>Round {i+1}</button>
                    ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-12 pt-2 custom-scrollbar">
                    {realBracketData.filter(m => m.roundNumber === selectedRound).map((match, idx) => {
                    const isReady = match.participants[0].name !== 'TBD' && match.participants[1].name !== 'TBD';
                    const isComplete = match.state === 'DONE';
                    
                    return (
                        <div key={match.id} className={`p-4 rounded-2xl flex flex-col gap-2.5 border ${isComplete ? 'bg-black/60 border-white/5 shadow-inner' : 'bg-[#0a0a0c] border-white/10 shadow-lg'}`}>
                        <div className="flex justify-between items-center border-b border-white/5 pb-2.5 mb-1">
                            <p className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">MATCH {idx + 1}</p>
                            {isComplete ? (
                                <span className="text-[9px] bg-green-500/10 text-green-500 font-bold px-2 py-0.5 rounded tracking-widest uppercase">COMPLETED</span>
                            ) : (
                                <button 
                                  disabled={!isReady || isTournamentFinished} 
                                  onClick={() => setScoreModal({ isOpen: true, match, scoreA: '', scoreB: '' })} 
                                  className="text-[10px] bg-white/5 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 font-bold uppercase tracking-widest disabled:opacity-50 transition border border-white/10"
                                >
                                  Input Score
                                </button>
                            )}
                        </div>
                        <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl border ${match.participants[0].isWinner ? 'bg-orange-500/10 border-orange-500/30' : 'bg-black/40 border-white/5'}`}><span className={`font-bold text-sm truncate pr-2 ${match.participants[0].isWinner ? 'text-orange-400' : 'text-zinc-300'}`}>{match.participants[0].name}</span><span className="font-black text-base text-white">{match.participants[0].score || '-'}</span></div>
                        <div className={`flex justify-between items-center px-3 py-2.5 rounded-xl border ${match.participants[1].isWinner ? 'bg-orange-500/10 border-orange-500/30' : 'bg-black/40 border-white/5'}`}><span className={`font-bold text-sm truncate pr-2 ${match.participants[1].isWinner ? 'text-orange-400' : 'text-zinc-300'}`}>{match.participants[1].name}</span><span className="font-black text-base text-white">{match.participants[1].score || '-'}</span></div>
                        </div>
                    );
                    })}
                </div>
                </div>
            )}
            </div>
        )}
      </div>

      {scoreModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0c] border border-white/10 rounded-4xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-xl font-black text-white mb-6 text-center">Record Score</h2>
            <form onSubmit={handleScoreSubmit} className="space-y-4">
              <div className="flex justify-between items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                <span className="font-bold text-sm text-zinc-300 flex-1 truncate">{scoreModal.match.participants[0].name}</span>
                <input required type="number" min="0" value={scoreModal.scoreA} onChange={(e) => setScoreModal({...scoreModal, scoreA: e.target.value})} className="w-16 h-12 bg-black border border-white/10 rounded-lg text-center text-lg font-black text-white focus:border-orange-500/50 outline-none" placeholder="0"/>
              </div>
              <div className="flex justify-between items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5 shadow-inner">
                <span className="font-bold text-sm text-zinc-300 flex-1 truncate">{scoreModal.match.participants[1].name}</span>
                <input required type="number" min="0" value={scoreModal.scoreB} onChange={(e) => setScoreModal({...scoreModal, scoreB: e.target.value})} className="w-16 h-12 bg-black border border-white/10 rounded-lg text-center text-lg font-black text-white focus:border-orange-500/50 outline-none" placeholder="0"/>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setScoreModal({ isOpen: false, match: null, scoreA: '', scoreB: '' })} className="h-12 rounded-xl font-bold text-sm bg-white/5 border border-white/10 text-white hover:bg-white/10 transition">Cancel</button>
                <button type="submit" disabled={isSubmittingScore} className="h-12 rounded-xl font-bold text-sm bg-orange-600 text-white disabled:opacity-50 hover:bg-orange-500 transition shadow-[0_8px_20px_rgba(234,88,12,0.25)]">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}