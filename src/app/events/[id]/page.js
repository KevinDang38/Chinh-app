"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { useLanguage } from "../../../context/LanguageContext";
import { SingleEliminationBracket, Match, createTheme } from '@g-loot/react-tournament-brackets';

const darkTheme = createTheme({
  textColor: { main: '#ffffff', highlighted: '#ea580c', dark: '#a1a1aa' },
  matchBackground: { wonColor: '#18181b', lostColor: '#18181b' },
  score: { background: { wonColor: '#ea580c', lostColor: '#27272a' }, text: { wonColor: '#ffffff', lostColor: '#ffffff' } },
  border: { color: '#27272a', highlightedColor: '#ea580c' },
  roundHeader: { backgroundColor: '#ea580c', fontColor: '#ffffff' },
  connectorColor: '#3f3f46', connectorColorHighlight: '#ea580c', svgBackground: '#09090b',
});

export default function EventDetailScreen() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); 
  
  const [pendingParticipants, setPendingParticipants] = useState([]);
  const [approvedParticipants, setApprovedParticipants] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  
  const [bracketData, setBracketData] = useState([]);
  const [manualSeeds, setManualSeeds] = useState([]);

  useEffect(() => { fetchEventData(); }, [id]);

  const fetchEventData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUser(session.user);

    const { data: eventData } = await supabase.from('events').select('*').eq('id', id).single();
    if (!eventData) return router.push("/events");
    setEvent(eventData);

    const { data: parts } = await supabase.from('event_participants').select('id, user_id, status, profiles(email, rating)').eq('event_id', id);
    if (parts) {
      const pending = parts.filter(p => p.status === 'pending');
      const approved = parts.filter(p => p.status === 'approved').sort((a, b) => b.profiles.rating - a.profiles.rating);
      
      setPendingParticipants(pending);
      setApprovedParticipants(approved);
      setManualSeeds(approved); 

      if (session) {
        const myEntry = parts.find(p => p.user_id === session.user.id);
        if (myEntry) { setIsJoined(true); setUserStatus(myEntry.status); }
      }
    }

    if (eventData.event_status !== 'registration') {
      const { data: matchNodes } = await supabase.from('tournament_matches').select(`*, player_a:player_a_id(email), player_b:team_b_player1_id(email)`).eq('event_id', id).order('round_number', { ascending: false });
      if (matchNodes && matchNodes.length > 0) {
        const formatted = matchNodes.map(m => ({
          id: m.id, nextMatchId: m.next_match_id, tournamentRoundText: `${m.round_number}`, state: m.status === 'completed' ? 'DONE' : 'SCHEDULED',
          participants: [
            { id: m.player_a_id || `tbd-a-${m.id}`, name: m.player_a?.email ? m.player_a.email.split('@')[0] : 'TBD', isWinner: m.winner_team === 'team_a', score: m.player_a_score },
            { id: m.team_b_player1_id || `tbd-b-${m.id}`, name: m.player_b?.email ? m.player_b.email.split('@')[0] : 'TBD', isWinner: m.winner_team === 'team_b', score: m.player_b_score }
          ]
        }));
        setBracketData(formatted);
      }
    }
  };

  const handleJoinEvent = async () => {
    if (!currentUser) return router.push('/login');
    setIsJoining(true);
    await supabase.from('event_participants').insert([{ event_id: id, user_id: currentUser.id, status: 'pending' }]);
    await fetchEventData();
    setIsJoining(false);
  };

  const handleApproval = async (participantId, newStatus) => {
    await supabase.from('event_participants').update({ status: newStatus }).eq('id', participantId);
    fetchEventData();
  };

  const handleGenerateBracket = async () => {
    if (manualSeeds.length < 2) return alert("Need at least 2 approved players!");
    if (!confirm("Lock the bracket using your current Seed Order?")) return;

    await supabase.from('events').update({ event_status: 'live', bracket_stage: 'live' }).eq('id', id);
    fetchEventData();
    setActiveTab('bracket');
  };

  const handleDragStart = (e, index) => { e.dataTransfer.setData("dragIndex", index); };
  const handleDrop = (e, dropIndex) => {
    const dragIndex = e.dataTransfer.getData("dragIndex");
    const updatedSeeds = [...manualSeeds];
    const [draggedItem] = updatedSeeds.splice(dragIndex, 1);
    updatedSeeds.splice(dropIndex, 0, draggedItem);
    setManualSeeds(updatedSeeds);
  };

  if (!event) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-bold">{t('common.loading')}</div>;

  const isAdmin = currentUser && event.creator_id === currentUser.id;
  const isTournament = event.event_category === 'single_elimination';
  const statusKey = event.event_status === 'completed' ? 'completed' : event.event_status === 'live' ? 'live' : 'registration';
  
  // Format Logic
  const isSingles = event.format === 'Singles';
  const formatPillStyle = isSingles 
    ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' 
    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';

  return (
    <main className="min-h-screen bg-black p-4 md:p-8 w-full">
      <div className="max-w-5xl mx-auto pb-24 mt-2 md:mt-6">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                event.event_status === 'completed' ? 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' : 
                event.event_status === 'live' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' : 
                'bg-green-500/10 text-green-500 border-green-500/20'
              }`}>
                {t(`events.status.${statusKey}`)}
              </span>
              
              <span className="bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-zinc-700">
                {isTournament ? t('events.status.tournament') : t('events.status.open_play')}
              </span>

              {/* Format Pill */}
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${formatPillStyle}`}>
                {isSingles ? t('common.singles') : t('common.doubles')}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2">{event.title}</h1>
            <p className="text-sm text-zinc-400 font-medium">📍 {event.location || 'TBD'} • 📅 {event.begin_date ? new Date(event.begin_date).toLocaleDateString() : 'TBA'}</p>
          </div>

          {!isAdmin && (
            <div className="w-full md:w-auto">
              {event.event_status === 'registration' ? (
                <button 
                  onClick={handleJoinEvent} 
                  disabled={isJoined || isJoining} 
                  className={`px-8 py-3 rounded-xl font-bold transition shadow-lg w-full ${isJoined || isJoining ? 'bg-zinc-800 text-zinc-400 cursor-default' : 'bg-orange-600 text-white hover:bg-orange-500 shadow-orange-900/50'}`}
                >
                  {isJoining ? t('events.buttons.processing') : isJoined ? (userStatus === 'approved' ? t('events.buttons.registered') : t('events.buttons.pending_approval')) : t('events.buttons.join_event')}
                </button>
              ) : (
                <div className="px-8 py-3 rounded-xl font-bold bg-zinc-900 border border-zinc-800 text-zinc-500 text-center w-full">
                  {event.event_status === 'completed' ? t('events.buttons.event_completed') : t('events.buttons.registration_closed')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* TABS */}
        <div className="flex bg-[#111111] rounded-xl p-1 mb-8 border border-zinc-800 w-full overflow-x-auto gap-1 custom-scrollbar">
          <button onClick={() => setActiveTab('overview')} className={`px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition ${activeTab === 'overview' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white'}`}>{t('events.tabs.overview')}</button>
          <button onClick={() => setActiveTab('participants')} className={`px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition ${activeTab === 'participants' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-white'}`}>{t('events.tabs.participants')} ({approvedParticipants.length})</button>
          
          {isTournament && event.event_status !== 'registration' && (
             <button onClick={() => setActiveTab('bracket')} className={`px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition flex items-center gap-2 ${activeTab === 'bracket' ? 'bg-orange-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}>{t('events.tabs.bracket')}</button>
          )}

          {isAdmin && (
             <button onClick={() => setActiveTab('admin')} className={`px-6 py-2.5 rounded-lg font-bold text-sm whitespace-nowrap transition flex items-center gap-2 ml-2 border ${activeTab === 'admin' ? 'bg-zinc-800 text-orange-500 border-zinc-700 shadow' : 'bg-transparent text-zinc-500 border-transparent hover:text-white'}`}>{t('events.tabs.admin')} {pendingParticipants.length > 0 && <span className="bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingParticipants.length}</span>}</button>
          )}
        </div>

        {/* CONTENT */}
        {activeTab === 'overview' && (
          <div className="bg-[#111111] p-8 rounded-2xl border border-zinc-800">
            <h3 className="text-xl font-bold text-white mb-4">{t('events.details.title')}</h3>
            <p className="text-zinc-400 mb-4">{t('events.details.welcome')}</p>
            {isTournament && (
              <p className="text-zinc-500 text-sm italic border-l-2 border-zinc-700 pl-4 mt-6">{t('events.details.bracket_note')}</p>
            )}
          </div>
        )}

        {activeTab === 'participants' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {approvedParticipants.length === 0 ? <div className="col-span-3 text-center p-12 border border-dashed border-zinc-800 rounded-2xl text-zinc-500 font-bold">{t('events.details.no_players')}</div> : (
              approvedParticipants.map((p, idx) => (
                <div key={p.id} className="bg-[#111111] p-5 rounded-xl border border-zinc-800 flex justify-between items-center transition hover:border-zinc-700">
                  <span className="font-bold text-white">#{idx + 1} {p.profiles?.email.split('@')[0]}</span>
                  <span className="bg-zinc-950 text-zinc-400 border border-zinc-800 px-2 py-1 rounded text-xs font-black">DUPR: {Number(p.profiles?.rating).toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'bracket' && bracketData.length > 0 && (
          <div className="bg-[#09090b] rounded-2xl border border-zinc-800 overflow-auto relative min-h-150 p-8 custom-scrollbar shadow-2xl">
            <div className="inline-block" style={{ minWidth: '1200px' }}>
              <SingleEliminationBracket matches={bracketData} matchComponent={Match} theme={darkTheme} />
            </div>
          </div>
        )}

        {/* ADMIN PANEL */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6">
            <div className="bg-[#111111] p-8 rounded-2xl border border-zinc-800">
              <h3 className="text-xl font-black text-white mb-2">{t('events.details.pending_title')}</h3>
              <p className="text-sm text-zinc-400 mb-6">{t('events.details.pending_desc')}</p>
              
              <div className="space-y-3">
                {pendingParticipants.length === 0 ? <p className="text-zinc-600 font-bold italic">{t('events.details.no_pending')}</p> : pendingParticipants.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-[#0a0a0a] p-4 rounded-xl border border-zinc-800">
                    <span className="font-bold text-white">{p.profiles?.email}</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleApproval(p.id, 'rejected')} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-lg font-bold text-sm transition hover:bg-red-500/20">{t('events.buttons.reject')}</button>
                      <button onClick={() => handleApproval(p.id, 'approved')} className="bg-green-500/10 text-green-500 px-4 py-2 rounded-lg font-bold text-sm transition hover:bg-green-500/20">{t('events.buttons.approve')}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {isTournament && event.event_status === 'registration' && (
              <div className="bg-[#111111] p-8 rounded-2xl border border-orange-500/30">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                    <h3 className="text-xl font-black text-white mb-1">{t('events.details.manage_seeds_title')}</h3>
                    <p className="text-sm text-zinc-400">{t('events.details.manage_seeds_desc')}</p>
                  </div>
                  <button onClick={handleGenerateBracket} className="bg-orange-600 text-white font-extrabold px-8 py-3 rounded-xl hover:bg-orange-500 transition shadow-lg shadow-orange-900/50 w-full md:w-auto">{t('events.buttons.lock_seeding')}</button>
                </div>
                
                <div className="space-y-2">
                  {manualSeeds.map((p, index) => (
                    <div key={p.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, index)} className="flex items-center gap-4 bg-[#0a0a0a] p-4 rounded-xl border border-zinc-800 cursor-grab active:cursor-grabbing hover:border-zinc-600 transition">
                      <div className="text-zinc-600">☰</div>
                      <span className="bg-zinc-800 text-white w-8 h-8 flex items-center justify-center rounded font-black text-sm">#{index + 1}</span>
                      <span className="font-bold text-white flex-1 truncate">{p.profiles?.email.split('@')[0]}</span>
                      <span className="text-orange-400 font-bold text-sm">DUPR: {Number(p.profiles?.rating).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {(event.event_status === 'live' || event.event_status === 'completed') && (
               <div className="bg-orange-500/10 border border-orange-500/30 p-8 rounded-2xl">
                 <h3 className="text-orange-500 font-black mb-2 text-xl">
                    {event.event_status === 'completed' ? t('events.buttons.event_completed') : t('events.status.live')}
                 </h3>
                 <p className="text-zinc-300 text-sm mb-6">Use your dedicated Secure Manager Dashboard to calculate the math engine, input scores, and officially end the tournament.</p>
                 <button onClick={() => router.push(`/events/${id}/manage`)} className="bg-orange-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-orange-900/50 transition hover:bg-orange-500 w-full md:w-auto">{t('events.buttons.open_manager')}</button>
               </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}