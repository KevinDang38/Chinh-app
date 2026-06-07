"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";
import { useLanguage } from "../../context/LanguageContext"; // <-- Import Hook

export default function Friends() {
  const { t } = useLanguage(); // <-- Init Hook

  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");

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
  };

  const addFriend = async (e) => {
    e.preventDefault();
    if (!user) return;
    const { data: friendProfile } = await supabase.from('profiles').select('id').eq('email', searchEmail).single();
    if (!friendProfile) return alert("User not found!");
    if (friendProfile.id === user.id) return alert("You cannot add yourself!");

    if (friends.some(f => f.id === friendProfile.id)) return alert("Already friends!");

    const { error } = await supabase.from('friends').insert([{ user_id: user.id, friend_id: friendProfile.id }]);
    if (error) alert("Error adding friend.");
    else { alert("Success!"); setSearchEmail(""); loadFriends(); }
  };

  const formatName = (email) => email ? email.split('@')[0] : t('common.guest');

  return (
    <main className="min-h-screen bg-black p-4 md:p-8 w-full">
      <div className="max-w-3xl mx-auto w-full">
        <div className="mb-8 border-b border-zinc-800 pb-4">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">{t('friends.title')}</h1>
        </div>

        <form onSubmit={addFriend} className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 mb-8 flex flex-col md:flex-row gap-4 shadow-xl">
          <input type="email" required value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)} placeholder={t('friends.searchPlaceholder')} className="flex-1 h-12 rounded-xl border border-zinc-800 px-4 bg-zinc-950 text-white focus:border-orange-500 outline-none transition-all" />
          <button type="submit" className="bg-orange-600 text-white font-extrabold px-6 py-3 rounded-xl hover:bg-orange-500 shadow-lg shadow-orange-900/50 transition">{t('friends.addBtn')}</button>
        </form>

        <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-4">{t('friends.myFriends')}</h2>
          {friends.length === 0 ? <p className="text-zinc-500">{t('friends.noFriends')}</p> : (
            <div className="space-y-3">
              {friends.map((friend) => (
                <Link href={`/profile/${friend.profile_hash}`} key={friend.id} className="flex justify-between items-center p-4 bg-zinc-950 rounded-2xl border border-zinc-800 hover:border-orange-500 transition group cursor-pointer">
                  <div className="flex flex-col truncate pr-4">
                    <span className="font-bold text-zinc-300 group-hover:text-orange-400 transition truncate">{formatName(friend.email)}</span>
                    <span className="text-xs text-zinc-600 font-bold mt-1 group-hover:text-orange-500/70 transition">{t('friends.viewProfile')}</span>
                  </div>
                  <span className="bg-orange-500/10 text-orange-400 font-bold px-4 py-2 rounded-xl text-sm whitespace-nowrap">{t('common.rating')}: {Number(friend.rating).toFixed(3)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}