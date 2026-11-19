"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";
import { Page, PageHeader, Loading, Avatar, Empty, Sheet, displayName } from "../../components/ui";

export default function Friends() {
  const { t } = useLanguage();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  const loadFriends = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUser(session.user);
      const userId = session.user.id;
      const { data: connections } = await supabase.from("friends").select("user_id, friend_id").or(`user_id.eq.${userId},friend_id.eq.${userId}`);
      if (connections?.length) {
        const friendIds = [...new Set(connections.map((c) => (c.user_id === userId ? c.friend_id : c.user_id)))];
        const { data: friendProfiles } = await supabase.from("profiles").select("id, email, rating, profile_hash").in("id", friendIds);
        setFriends((friendProfiles || []).sort((a, b) => b.rating - a.rating));
      } else setFriends([]);
    } else {
      setUser(null);
      setFriends([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadFriends(); }, []);

  const addFriend = async (e) => {
    e.preventDefault();
    if (!user) return setShowGuestPrompt(true);
    setSearchLoading(true);
    setMessage(null);
    const email = searchEmail.toLowerCase().trim();
    const { data: friendProfile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!friendProfile) setMessage({ ok: false, text: t("friends.notFound") });
    else if (friendProfile.id === user.id) setMessage({ ok: false, text: t("friends.notYourself") });
    else if (friends.some((f) => f.id === friendProfile.id)) setMessage({ ok: false, text: t("friends.already") });
    else {
      const { error } = await supabase.from("friends").insert([{ user_id: user.id, friend_id: friendProfile.id }]);
      if (error) setMessage({ ok: false, text: t("friends.addFailed") });
      else {
        setMessage({ ok: true, text: t("friends.added") });
        setSearchEmail("");
        loadFriends();
      }
    }
    setSearchLoading(false);
  };

  if (loading) return <Loading text={t("common.loading")} />;

  return (
    <Page>
      <PageHeader title={t("friends.title")} sub={t("friends.sub")} />

      <form onSubmit={addFriend} className="flex gap-2">
        <label htmlFor="friend-email" className="sr-only">{t("friends.searchPlaceholder")}</label>
        <input id="friend-email" type="email" required value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)}
          placeholder={t("friends.searchPlaceholder")} className="field flex-1" autoComplete="off" />
        <button type="submit" disabled={searchLoading || !searchEmail} className="btn btn-primary shrink-0" aria-label={t("friends.addBtn")}>
          {searchLoading ? <span className="spinner !border-white/30 !border-t-white" /> : <><UserPlus size={18} /><span className="hidden sm:inline">{t("friends.addBtn")}</span></>}
        </button>
      </form>
      {message && <p role="status" className={`mt-2 text-[0.9375rem] ${message.ok ? "text-win" : "text-loss"}`}>{message.text}</p>}

      <h2 className="heading mt-8 mb-3">{t("friends.myFriends")} <span className="faint font-normal">{friends.length}</span></h2>
      {friends.length === 0 ? (
        <Empty>{user ? t("friends.noFriends") : t("friends.guestEmpty")}</Empty>
      ) : (
        <ol className="panel rows">
          {friends.map((friend, i) => (
            <li key={friend.id}>
              <Link href={`/profile/${friend.profile_hash}`} className="flex items-center gap-3 px-4 py-3 min-h-16 hover:bg-court-tint/50">
                <span className="num w-6 text-center faint">{i + 1}</span>
                <Avatar email={friend.email} />
                <span className="font-semibold flex-1 truncate">{displayName(friend.email)}</span>
                <span className="num text-lg">{Number(friend.rating).toFixed(3)}</span>
                <ChevronRight size={18} className="faint" />
              </Link>
            </li>
          ))}
        </ol>
      )}

      <Sheet open={showGuestPrompt} onClose={() => setShowGuestPrompt(false)} title={t("guest.title")}>
        <p className="muted mb-5">{t("guest.friendsBody")}</p>
        <button onClick={() => router.push("/login")} className="btn btn-primary w-full">{t("guest.cta")}</button>
        <button onClick={() => setShowGuestPrompt(false)} className="btn btn-quiet w-full mt-2">{t("guest.later")}</button>
      </Sheet>
    </Page>
  );
}
