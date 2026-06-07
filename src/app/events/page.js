"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import { useLanguage } from "../../context/LanguageContext";

export default function EventsPage() {
  const { t } = useLanguage(); 
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [userRating, setUserRating] = useState("0.000");
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [duprQuery, setDuprQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('rating').eq('id', session.user.id).single();
        if (profile?.rating) setUserRating(Number(profile.rating).toFixed(3));
      }

      const { data: eventsData } = await supabase.from('events').select('*').order('begin_date', { ascending: true });
      const { data: partsData } = await supabase.from('event_participants').select('event_id');

      if (eventsData) {
        const eventsWithCounts = eventsData.map(ev => ({
          ...ev,
          participantCount: partsData ? partsData.filter(p => p.event_id === ev.id).length : 0
        }));
        setEvents(eventsWithCounts);
        setFilteredEvents(eventsWithCounts);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  useEffect(() => {
    let result = events;
    if (searchQuery) result = result.filter(e => e.title?.toLowerCase().includes(searchQuery.toLowerCase()));
    if (regionQuery) result = result.filter(e => (e.region?.toLowerCase().includes(regionQuery.toLowerCase())) || (e.location?.toLowerCase().includes(regionQuery.toLowerCase())));
    if (duprQuery) {
      const userVal = parseFloat(duprQuery);
      if (!isNaN(userVal)) result = result.filter(e => userVal >= (parseFloat(e.min_dupr) || 0) && userVal <= (parseFloat(e.max_dupr) || 10));
    }
    setFilteredEvents(result);
  }, [searchQuery, regionQuery, duprQuery, events]);

  if (loading) return <div className="min-h-screen bg-black text-zinc-500 flex justify-center items-center font-bold">{t('common.loading')}</div>;

  return (
    <main className="min-h-screen bg-black p-4 md:p-8 w-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 mt-6">
          <h1 className="text-3xl font-extrabold text-white mb-2">{t('events.list.title')}</h1>
          <p className="text-zinc-400">{t('events.list.currentRating')} <span className="text-orange-500 font-bold">{userRating}</span></p>
        </div>

        <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <input type="text" placeholder={t('events.list.searchPlaceholder')} onChange={(e) => setSearchQuery(e.target.value)} className="bg-[#0a0a0a] border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none" />
          <input type="text" placeholder={t('events.list.regionPlaceholder')} onChange={(e) => setRegionQuery(e.target.value)} className="bg-[#0a0a0a] border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none" />
          <input type="number" placeholder={t('events.list.duprPlaceholder')} onChange={(e) => setDuprQuery(e.target.value)} className="bg-[#0a0a0a] border border-zinc-800 text-white rounded-xl px-4 py-3 outline-none" />
        </div>

        <div className="space-y-4 pb-24">
          {filteredEvents.map((event) => {
            const statusKey = event.event_status === 'completed' ? 'completed' : event.event_status === 'live' ? 'live' : 'registration';
            const isTournament = event.event_category === 'single_elimination';
            
            // Format styling logic: Orange for Singles, Blue for Doubles
            const isSingles = event.format === 'Singles';
            const formatPillStyle = isSingles 
              ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' 
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';

            return (
              <Link href={`/events/${event.id}`} key={event.id} className="block group">
                <div className="bg-[#111111] border border-zinc-800 rounded-2xl p-6 hover:border-orange-500/50 transition flex justify-between items-center">
                  <div>
                    <div className="flex gap-2 mb-3">
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
                    </div>

                    <h2 className="text-xl font-extrabold text-white">{event.title}</h2>
                    <p className="text-zinc-400 text-sm mb-3">📍 {event.location || 'TBD'} • 📅 {event.begin_date ? new Date(event.begin_date).toLocaleDateString() : 'TBA'}</p>
                    
                    <div className="flex gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${formatPillStyle}`}>
                         {isSingles ? t('common.singles') : t('common.doubles')}
                      </span>
                      <span className="bg-zinc-800 text-zinc-300 text-xs px-3 py-1 rounded font-bold">👥 {event.participantCount} / {event.max_players}</span>
                    </div>
                  </div>
                  
                  <div className="bg-zinc-800 text-white px-6 py-3 rounded-xl font-bold group-hover:bg-orange-600 transition">
                    {t('events.buttons.view_details')}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}