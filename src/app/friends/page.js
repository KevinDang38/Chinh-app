"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../context/LanguageContext";
import { Search, UserPlus, Users, Trophy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const getInitials = (email) => {
  if (!email) return '?';
  return email.substring(0, 2).toUpperCase();
};

export default function Friends() {
  const { t } = useLanguage();
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  useEffect(() => { loadFriends(); }, []);

  const loadFriends = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const userId = session.user.id;

      const { data: connections } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (connections && connections.length > 0) {
        const friendIds = [...new Set(connections.map(c => c.user_id === userId ? c.friend_id : c.user_id))];
        const { data: friendProfiles } = await supabase.from('profiles').select('id, email, rating, profile_hash').in('id', friendIds);
        if (friendProfiles) setFriends(friendProfiles);
      } else {
        setFriends([]);
      }
    } else {
      setUser(null);
      setFriends([]);
    }
    setLoading(false);
  };

  const addFriend = async (e) => {
    e.preventDefault();
    if (!user) {
      setShowGuestPrompt(true);
      return;
    }
    
    setSearchLoading(true);

    const { data: friendProfile } = await supabase.from('profiles').select('id').eq('email', searchEmail.toLowerCase().trim()).single();
    
    if (!friendProfile) {
      alert("User not found!");
      setSearchLoading(false);
      return;
    }
    if (friendProfile.id === user.id) {
      alert("You cannot add yourself!");
      setSearchLoading(false);
      return;
    }
    if (friends.some(f => f.id === friendProfile.id)) {
      alert("Already friends!");
      setSearchLoading(false);
      return;
    }

    const { error } = await supabase.from('friends').insert([{ user_id: user.id, friend_id: friendProfile.id }]);
    
    if (error) {
      alert("Error adding friend.");
    } else { 
      alert("Success!"); 
      setSearchEmail(""); 
      loadFriends(); 
    }
    setSearchLoading(false);
  };

  const formatName = (email) => email ? email.split('@')[0] : t('common.guest');

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
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">

        <div className="glass-panel p-5 sm:p-6 rounded-3xl relative overflow-hidden group border border-white/5 bg-linear-to-br from-white/3 to-transparent">
          <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/10 rounded-full blur-[80px] -mr-10 -mt-10 pointer-events-none group-hover:bg-orange-500/20 transition-all duration-700"></div>
          
          <div className="relative z-10">
            <form onSubmit={addFriend} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-zinc-500" />
                </div>
                <input 
                  type="email" 
                  required 
                  value={searchEmail} 
                  onChange={(e) => setSearchEmail(e.target.value)} 
                  placeholder={t('friends.searchPlaceholder')} 
                  className="w-full h-12 pl-12 pr-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-sm font-bold" 
                />
              </div>
              <button 
                type="submit" 
                disabled={searchLoading || !searchEmail}
                className="h-12 whitespace-nowrap bg-orange-600 text-white font-bold px-6 rounded-xl text-sm hover:bg-orange-500 active:scale-95 transition-all shadow-[0_8px_20px_rgba(234,88,12,0.25)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
              >
                {searchLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UserPlus size={16} />
                    {t('friends.addBtn')}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/5 bg-linear-to-br from-white/1 to-transparent shadow-2xl">
          <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
            {t('friends.myFriends')}
          </h2>
          
          {friends.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-white/5 rounded-2xl bg-white/1">
              <div className="w-14 h-14 glass-card rounded-full flex items-center justify-center mx-auto mb-3 border border-white/5">
                <Users className="w-6 h-6 text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-xs font-medium max-w-xs mx-auto">
                {!user ? "Add friends to team up, compare official DUPR ratings, and challenge each other on the courts!" : t('friends.noFriends')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {friends.map((friend) => (
                <Link 
                  href={`/profile/${friend.profile_hash}`} 
                  key={friend.id} 
                  className="group flex items-center justify-between p-3.5 bg-black/40 rounded-xl border border-white/5 hover:bg-white/3 hover:border-orange-500/30 transition-all duration-300 cursor-pointer shadow-inner"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-black border border-white/10 flex items-center justify-center font-black text-xs text-zinc-400 shadow-inner group-hover:border-orange-500/50 group-hover:text-orange-400 transition-colors">
                      {getInitials(friend.email)}
                    </div>
                    <div className="flex flex-col truncate pr-2 justify-center">
                      <span className="font-bold text-white truncate text-sm group-hover:text-orange-400 transition-colors">
                        {formatName(friend.email)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 text-right">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">
                      {t('common.rating')}
                    </span>
                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 font-black px-2.5 py-1 rounded-lg text-sm inline-block">
                      {Number(friend.rating).toFixed(3)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Guest Prompt Modal */}
      <AnimatePresence>
        {showGuestPrompt && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm touch-none" 
              onClick={() => setShowGuestPrompt(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-sm glass-panel p-6 rounded-4xl border border-white/10 bg-[#0a0a0c]/95 text-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-4 border border-orange-500/20">
                <Users className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Build Your Roster!</h3>
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed px-2">
                Create a free account to add friends, compare ratings, and quickly team up for live matches.
              </p>
              <div className="space-y-3">
                <button onClick={() => router.push('/login')} className="w-full h-12 bg-orange-600 text-white font-bold rounded-xl text-base hover:bg-orange-500 active:scale-scale-95 transition-all shadow-[0_8px_20px_rgba(234,88,12,0.25)]">
                  Sign In / Create Account
                </button>
                <button onClick={() => setShowGuestPrompt(false)} className="w-full h-12 bg-white/5 text-zinc-300 font-bold rounded-xl text-sm hover:bg-white/10 active:scale-95 transition-all">
                  Not Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}