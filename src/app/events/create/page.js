"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../../context/LanguageContext";
import { motion } from "framer-motion";
import { Calendar, MapPin, Trophy, Users, DollarSign, Activity, Globe, Target } from "lucide-react";

export default function HostEvent() {
  const router = useRouter();
  const { t } = useLanguage();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("tournament");
  const [format, setFormat] = useState("doubles");
  const [beginDate, setBeginDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [region, setRegion] = useState("");
  const [location, setLocation] = useState("");
  const [minDupr, setMinDupr] = useState("");
  const [maxDupr, setMaxDupr] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [entryFee, setEntryFee] = useState("");

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
      } else {
        setCurrentUser(session.user);
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    if (maxPlayers && parseInt(maxPlayers) % 2 !== 0) {
      alert(t('events.create.error_even_players'));
      setLoading(false);
      return;
    }

    const { data: eventData, error: eventError } = await supabase.from('events').insert([
      {
        host_id: currentUser.id,
        title,
        event_type: eventType,
        format,
        begin_date: beginDate,
        end_date: endDate,
        region,
        location,
        min_dupr: minDupr ? parseFloat(minDupr) : 0,
        max_dupr: maxDupr ? parseFloat(maxDupr) : 8.0,
        max_players: maxPlayers ? parseInt(maxPlayers) : null,
        entry_fee: entryFee || t('events.create.free'),
        status: 'registration'
      }
    ]).select().single();

    setLoading(false);

    if (eventError) {
      alert("Error creating event: " + eventError.message);
    } else {
      router.push(`/events/${eventData.id}`);
    }
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } } };

  return (
    <main className="min-h-dvh p-4 pb-32 pt-20 md:pt-8 md:p-8 w-full bg-[#050507]">
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="max-w-3xl mx-auto">
        
        <motion.div variants={itemVariants} className="mb-10 text-center sm:text-left">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tighter drop-shadow-sm mb-4 leading-[0.9]">
            {t('events.create.title')}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base font-medium max-w-xl">{t('events.create.subtitle')}</p>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          
          <motion.div variants={itemVariants} className="glass-panel p-6 sm:p-10 rounded-4xl relative overflow-hidden shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
            
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-orange-500" /> 
              </div>
              {t('events.create.basicDetails')}
            </h2>

            <div className="space-y-5 relative z-10">
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.event_title')}</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('events.create.titlePlaceholder')} className="w-full h-12 px-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-sm font-bold" />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.event_type')}</label>
                  <div className="flex glass-card rounded-xl p-1 border border-white/5 bg-black/40 relative z-20 h-12">
                    {[
                      { id: 'tournament', label: t('events.create.type_tournament') },
                      { id: 'open_play', label: t('events.create.type_open') }
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setEventType(type.id)}
                        className={`relative flex-1 rounded-lg font-bold text-xs sm:text-sm outline-none transition-colors duration-300 ${
                          eventType === type.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {eventType === type.id && (
                          <motion.div
                            layoutId="eventTypeIndicator"
                            className="absolute inset-0 bg-white/10 rounded-lg shadow-md border border-white/10"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="relative z-10 block tracking-wide">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.format')}</label>
                  <div className="flex glass-card rounded-xl p-1 border border-white/5 bg-black/40 relative z-20 h-12">
                    {[
                      { id: 'singles', label: t('events.create.singles') },
                      { id: 'doubles', label: t('events.create.doubles') }
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormat(f.id)}
                        className={`relative flex-1 rounded-lg font-bold text-xs sm:text-sm outline-none transition-colors duration-300 ${
                          format === f.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {format === f.id && (
                          <motion.div
                            layoutId="formatIndicator"
                            className="absolute inset-0 bg-white/10 rounded-lg shadow-md border border-white/10"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                        <span className="relative z-10 block tracking-wide">{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel p-6 sm:p-10 rounded-4xl relative overflow-hidden shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
            
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-blue-500" /> 
              </div>
              {t('events.create.logisticsTime')}
            </h2>
            
            <div className="space-y-5 relative z-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.begin_date')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input type="date" required value={beginDate} onChange={(e) => setBeginDate(e.target.value)} className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-blue-500/50 transition-all shadow-inner scheme-dark text-sm font-bold appearance-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.end_date')}</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-blue-500/50 transition-all shadow-inner scheme-dark text-sm font-bold appearance-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.location')}</label>
                  <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('events.create.locationPlaceholder')} className="w-full h-12 px-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-sm font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.region')}</label>
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input type="text" required value={region} onChange={(e) => setRegion(e.target.value)} placeholder={t('events.create.regionPlaceholder')} className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-sm font-bold" />
                  </div>
                </div>
              </div>

              <div className="bg-black/20 p-5 rounded-2xl border border-white/5">
                <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.entryFeeOptional')}</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500/70" />
                  <input type="text" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} placeholder={t('events.create.feePlaceholder')} className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-green-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-sm font-bold" />
                </div>
                <p className="text-[10px] text-zinc-500 font-bold mt-2.5 pl-1">{t('events.create.paymentDisclaimer')}</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="glass-panel p-6 sm:p-10 rounded-4xl relative overflow-hidden shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px] -mr-20 -mt-20 pointer-events-none"></div>
            
            <h2 className="text-xl font-black text-white mb-6 flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Target className="w-5 h-5 text-purple-500" /> 
              </div>
              {t('events.create.restrictionsLimits')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 relative z-10">
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.min_dupr')}</label>
                <input type="number" step="0.001" min="0" max="8" value={minDupr} onChange={(e) => setMinDupr(e.target.value)} placeholder="0.000" className="w-full h-12 px-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500/50 transition-all placeholder:text-zinc-600 shadow-inner no-spinners text-sm font-bold" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.max_dupr')}</label>
                <input type="number" step="0.001" min="0" max="8" value={maxDupr} onChange={(e) => setMaxDupr(e.target.value)} placeholder="8.000" className="w-full h-12 px-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500/50 transition-all placeholder:text-zinc-600 shadow-inner no-spinners text-sm font-bold" />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 pl-1">{t('events.create.max_players')}</label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                  <input type="number" min="2" step="2" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder={t('events.create.openPlayers')} className="w-full h-12 pl-10 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-purple-500/50 transition-all placeholder:text-zinc-600 shadow-inner no-spinners text-sm font-bold" />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="pt-4">
            <button type="submit" disabled={loading} className="w-full h-12 bg-orange-600 text-white font-bold rounded-xl text-base hover:bg-orange-500 active:scale-95 transition-all shadow-[0_8px_20px_rgba(234,88,12,0.25)] disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <><Activity className="w-5 h-5" /> {t('events.create.publish_btn')}</>}
            </button>
          </motion.div>
        </form>
      </motion.div>

      <style jsx global>{`
        input.no-spinners::-webkit-outer-spin-button,
        input.no-spinners::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number].no-spinners { -moz-appearance: textfield; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor: pointer; opacity: 0; }
      `}</style>
    </main>
  );
}