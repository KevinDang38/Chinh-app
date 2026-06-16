"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import { useLanguage } from "../../context/LanguageContext";
import { Search, UserPlus, ChevronRight, User } from "lucide-react";

// --- HELPER FUNCTION ---
const getInitials = (email) => {
  if (!email) return '?';
  return email.substring(0, 2).toUpperCase();
};

export default function Friends() {
  const { t } = useLanguage();

  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);

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
    }
    setLoading(false);
  };

  const addFriend = async (e) => {
    e.preventDefault();
    if (!user) return;
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

  const formatName = (email) => email ? email.split('@')[0] : (t('common.guest') || 'Guest');

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center font-bold text-zinc-500 bg-[#050507]">
      <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4"></div>
      {t('common.loading') || 'Loading...'}
    </div>
  );

  return (
    <main 
      className="min-h-screen px-4 py-6 md:p-8 w-full pb-24 overflow-y-auto overflow-x-hidden touch-pan-y bg-[#050507]" 
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">

        {/* SEARCH / ADD FRIEND WIDGET */}
        <div className="glass-panel p-5 sm:p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none group-hover:bg-orange-500/20 transition-all duration-700"></div>
          
          <div className="relative z-10">
            <form onSubmit={addFriend} className="flex flex-col md:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 sm:pl-5 flex items-center pointer-events-none">
                  <Search className="w-5 h-5 text-zinc-500" />
                </div>
                <input 
                  type="email" 
                  required 
                  value={searchEmail} 
                  onChange={(e) => setSearchEmail(e.target.value)} 
                  placeholder={t('friends.searchPlaceholder') || "Enter friend's email..."} 
                  className="w-full h-14 sm:h-16 pl-12 sm:pl-14 pr-4 bg-black/40 border border-white/10 rounded-2xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-base sm:text-lg" 
                />
              </div>
              <button 
                type="submit" 
                disabled={searchLoading || !searchEmail}
                className="h-14 sm:h-16 whitespace-nowrap bg-orange-600 text-white font-extrabold px-6 sm:px-8 rounded-2xl hover:bg-orange-500 active:scale-95 transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
              >
                {searchLoading ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <UserPlus size={20} />
                    {t('friends.addBtn') || 'Add Friend'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* FRIENDS ROSTER */}
        <div className="glass-panel p-5 sm:p-8 rounded-3xl">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-2">
            {t('friends.myFriends') || 'Friends List'}
          </h2>
          
          {friends.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-white/5 rounded-2xl bg-white/1">
              <div className="w-16 h-16 glass-card rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                <Users className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500 text-sm font-medium">{t('friends.noFriends') || "You haven't added anyone yet."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {friends.map((friend) => (
                <Link 
                  href={`/profile/${friend.profile_hash}`} 
                  key={friend.id} 
                  className="group flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:bg-white/3 hover:border-orange-500/30 transition-all duration-300 cursor-pointer shadow-inner"
                >
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-12 h-12 shrink-0 rounded-full bg-black border border-white/10 flex items-center justify-center font-black text-sm text-zinc-400 shadow-inner group-hover:border-orange-500/50 group-hover:text-orange-400 transition-colors">
                      {getInitials(friend.email)}
                    </div>
                    <div className="flex flex-col truncate pr-2">
                      <span className="font-bold text-white truncate text-base sm:text-lg group-hover:text-orange-400 transition-colors">
                        {formatName(friend.email)}
                      </span>
                      <span className="text-[10px] sm:text-xs text-zinc-500 font-bold uppercase tracking-wider mt-0.5 group-hover:text-zinc-400 transition-colors flex items-center gap-1">
                        {t('friends.viewProfile') || 'View Profile & History'} <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 text-right">
                    <span className="text-[9px] sm:text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">
                      {t('common.rating') || 'Rating'}
                    </span>
                    <span className="bg-orange-500/10 border border-orange-500/20 text-orange-400 font-black px-3 py-1.5 rounded-xl text-sm sm:text-base inline-block">
                      {Number(friend.rating).toFixed(3)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}