"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import { useLanguage } from "../../context/LanguageContext";
import { motion } from "framer-motion";
import { Search, Calendar, MapPin, Trophy, Users, ChevronRight, Crown } from "lucide-react";

export default function EventsList() {
  const { t } = useLanguage();
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*, event_participants(status)')
      .order('begin_date', { ascending: true });
      
    if (data && data.length > 0) {
      const hostIds = [...new Set(data.map(e => e.host_id).filter(Boolean))];
      let hostProfiles = [];
      
      if (hostIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', hostIds);
          if (profilesData) hostProfiles = profilesData;
      }

      const processedEvents = data.map(ev => {
        const approvedCount = ev.event_participants 
          ? ev.event_participants.filter(p => p.status === 'approved').length 
          : 0;
        const hostInfo = hostProfiles.find(p => p.id === ev.host_id);
        
        return { ...ev, approvedCount, host_email: hostInfo?.email || null };
      });
      
      setEvents(processedEvents);
    } else {
      setEvents([]);
    }
    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'live': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'registration_closed': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'completed': return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20'; 
    }
  };

  const getFormatDisplayStatus = (status) => {
    const s = status?.toLowerCase();
    if (s === 'live') return t('events.status.live');
    if (s === 'registration_closed') return t('events.status.closed');
    if (s === 'completed') return t('events.status.completed');
    return t('events.status.open');
  };

  const filteredEvents = events.filter(e => 
    e.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-bold text-zinc-500 bg-[#050507]">
      <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
      {t('common.loading')}
    </div>
  );

  return (
    <main 
      className="min-h-screen px-4 py-6 md:p-8 w-full pb-24 overflow-y-auto overflow-x-hidden touch-pan-y bg-[#050507]"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-5xl mx-auto space-y-6"
      >
        
        <div className="glass-panel p-5 sm:p-6 rounded-3xl relative overflow-hidden group border border-white/5 bg-linear-to-br from-white/3 to-transparent">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-[80px] -mr-10 -mt-10 pointer-events-none transition-all duration-700"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tighter drop-shadow-sm mb-1">
                {t('events.list.title')}
              </h1>
              <p className="text-zinc-400 text-sm font-medium">
                {t('events.list.searchLabel')}
              </p>
            </div>
            
            <div className="w-full md:w-80 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('events.list.searchPlaceholder')}
                className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-sm appearance-none"
              />
            </div>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl bg-white/1">
            <div className="w-14 h-14 glass-card rounded-full flex items-center justify-center mx-auto mb-3 border border-white/5">
              <Trophy className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-zinc-500 text-sm font-medium">
              {t('events.list.noEvents')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEvents.map((event) => (
              <Link href={`/events/${event.id}`} key={event.id} className="group">
                <div className="bg-[#0a0a0c] p-4.5 rounded-2xl border border-white/5 hover:border-orange-500/30 hover:bg-[#0c0c0e] transition-all duration-300 h-full flex flex-col relative overflow-hidden shadow-lg">
                  
                  <div className="flex justify-between items-start mb-3 h-7">
                    <div className="flex gap-2">
                      <span className="bg-white/5 border border-white/10 text-zinc-300 text-[9px] font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wider whitespace-nowrap">
                        {event.format === 'singles' ? t('common.singles') : t('common.doubles')}
                      </span>
                      <span className={`border text-[9px] font-black px-2.5 py-1.5 rounded-lg uppercase tracking-widest whitespace-nowrap truncate max-w-30 ${getStatusColor(event.status)}`}>
                        {getFormatDisplayStatus(event.status)}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-white mb-3 group-hover:text-orange-400 transition-colors line-clamp-2">
                    {event.title}
                  </h3>
                  
                  <div className="mt-auto space-y-2.5 mb-5">
                    <div className="flex items-center gap-2.5 text-zinc-400 text-sm">
                      <Calendar className="w-4 h-4 text-orange-500/70 shrink-0" />
                      <span className="truncate">{new Date(event.begin_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-zinc-400 text-sm">
                      <MapPin className="w-4 h-4 text-orange-500/70 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                  </div>

                  <div className="mt-auto pt-3.5 border-t border-white/5 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 shrink-0 text-zinc-500" /> 
                          {event.approvedCount !== undefined ? event.approvedCount : 0} / {event.max_players || '∞'}
                        </span>
                        
                        {event.host_email && (
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Crown className="w-3.5 h-3.5 shrink-0 text-orange-500/50" /> 
                            {t('events.details.hostedBy')} <span className="text-zinc-400">{event.host_email.split('@')[0]}</span>
                          </span>
                        )}
                    </div>
                    
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors shrink-0">
                      <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-orange-500" />
                    </div>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        )}

      </motion.div>
    </main>
  );
}