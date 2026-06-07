"use client";
import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../../context/LanguageContext";

export default function CreateEvent() {
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  
  const [formData, setFormData] = useState({
    title: "",
    event_category: "single_elimination",
    format: "Doubles",
    begin_date: "",
    end_date: "",
    region: "",
    location: "",
    min_dupr: 3.0,
    max_dupr: 4.0,
    max_players: 16
  });

  const inputStyle = "block w-full h-12 rounded-xl border border-zinc-800 px-4 text-white bg-zinc-950 focus:border-orange-500 outline-none transition-all";

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");
      setUser(session.user);
    };
    checkAdmin();
  }, [router]);

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (formData.max_players % 2 !== 0) {
      return alert(t('events.create.error_even_players'));
    }

    // Convert dates to ISO
    const startDate = new Date(formData.begin_date).toISOString();
    const endDate = new Date(formData.end_date).toISOString();

    const { error } = await supabase.from('events').insert([{
        title: formData.title,
        event_category: formData.event_category,
        format: formData.format,
        // Mapping to date_time to fix your NOT NULL constraint error
        date_time: startDate, 
        begin_date: startDate,
        end_date: endDate,
        region: formData.region,
        location: formData.location,
        min_dupr: Number(formData.min_dupr),
        max_dupr: Number(formData.max_dupr),
        max_players: Number(formData.max_players),
        creator_id: user.id,
        event_status: 'registration'
    }]);

    if (!error) {
      router.push("/events");
    } else {
      alert("Error: " + error.message);
    }
  };

  return (
    <main className="min-h-screen bg-black p-4 md:p-8 flex items-start md:items-center justify-center w-full pb-24">
      <div className="bg-zinc-900 p-6 md:p-8 rounded-3xl border border-zinc-800 w-full max-w-xl shadow-2xl mt-4 md:mt-0">
        <div className="mb-6 border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-extrabold text-white">{t('events.create.title')}</h1>
        </div>
        
        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.event_title')}</label>
            <input type="text" required value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputStyle} placeholder={t('events.create.titlePlaceholder')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.event_type')}</label>
              <select required value={formData.event_category} onChange={(e) => setFormData({...formData, event_category: e.target.value})} className={inputStyle}>
                <option value="single_elimination">{t('events.create.type_tournament')}</option>
                <option value="open_play">{t('events.create.type_open')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.format')}</label>
              <select required value={formData.format} onChange={(e) => setFormData({...formData, format: e.target.value})} className={inputStyle}>
                <option value="Singles">{t('events.create.singles')}</option>
                <option value="Doubles">{t('events.create.doubles')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.begin_date')}</label>
              <input type="datetime-local" required value={formData.begin_date} onChange={(e) => setFormData({...formData, begin_date: e.target.value})} className={`${inputStyle} px-2`} style={{colorScheme: 'dark'}} />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.end_date')}</label>
              <input type="datetime-local" required value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} className={`${inputStyle} px-2`} style={{colorScheme: 'dark'}} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.region')}</label>
              <input type="text" required value={formData.region} onChange={(e) => setFormData({...formData, region: e.target.value})} className={inputStyle} placeholder={t('events.create.regionPlaceholder')} />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.location')}</label>
              <input type="text" required value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className={inputStyle} placeholder={t('events.create.locationPlaceholder')} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.min_dupr')}</label>
              <input type="number" step="0.01" required value={formData.min_dupr} onChange={(e) => setFormData({...formData, min_dupr: e.target.value})} className={`${inputStyle} [appearance:textfield]`} />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.max_dupr')}</label>
              <input type="number" step="0.01" required value={formData.max_dupr} onChange={(e) => setFormData({...formData, max_dupr: e.target.value})} className={`${inputStyle} [appearance:textfield]`} />
            </div>
            <div>
              <label className="block text-sm font-bold text-zinc-400 mb-2">{t('events.create.max_players')}</label>
              <input type="number" min="2" step="2" required value={formData.max_players} onChange={(e) => setFormData({...formData, max_players: e.target.value})} className={`${inputStyle} [appearance:textfield]`} />
            </div>
          </div>

          <button type="submit" className="w-full bg-orange-600 text-white font-extrabold py-4 rounded-xl hover:bg-orange-500 mt-6 shadow-lg shadow-orange-900/50 transition text-lg">
            {t('events.create.publish_btn')}
          </button>
        </form>
      </div>
    </main>
  );
}