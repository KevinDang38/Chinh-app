"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Check, UserPlus, ChevronRight } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { useLanguage } from "../../../context/LanguageContext";
import { Page, Loading, CourtRating, Segmented, ResultTag, Change, Empty, Avatar, displayName } from "../../../components/ui";
import { summarize } from "../../../lib/matchHistory";

export default function UserProfile() {
  const { id } = useParams();
  const router = useRouter();
  const { t, language } = useLanguage();

  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isFriend, setIsFriend] = useState(false);
  const [matchTab, setMatchTab] = useState("1v1");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUser(session.user);

      const { data: profileData } = await supabase.from("profiles").select("*").eq("profile_hash", id).single();
      if (!profileData) return router.push("/dashboard");
      setProfile(profileData);
      const targetUserId = profileData.id;

      if (session) {
        const { data: links } = await supabase.from("friends").select("id")
          .or(`and(user_id.eq.${session.user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${session.user.id})`);
        if (links?.length) setIsFriend(true);
      }

      const { data: connections } = await supabase.from("friends").select("user_id, friend_id").or(`user_id.eq.${targetUserId},friend_id.eq.${targetUserId}`);
      if (connections?.length) {
        const friendIds = [...new Set(connections.map((c) => (c.user_id === targetUserId ? c.friend_id : c.user_id)))];
        const { data: friendProfiles } = await supabase.from("profiles").select("id, email, rating, profile_hash").in("id", friendIds);
        if (friendProfiles) setFriends(friendProfiles);
      }

      const { data: matchData } = await supabase.from("matches").select("*").eq("counted", true)
        .or(`player_a_id.eq.${targetUserId},team_a_player2_id.eq.${targetUserId},team_b_player1_id.eq.${targetUserId},team_b_player2_id.eq.${targetUserId}`)
        .order("created_at", { ascending: true });
      setMatches(matchData || []);
      setLoading(false);
    };
    fetchAllData();
  }, [id, router]);

  const handleAddFriend = async () => {
    if (!currentUser) return router.push("/login");
    const { error } = await supabase.from("friends").insert([{ user_id: currentUser.id, friend_id: profile.id }]);
    if (error) alert(error.message);
    else setIsFriend(true);
  };

  if (loading) return <Loading text={t("common.loading")} />;

  const s = summarize(matches, profile.id, profile, language, t);
  const shown = (matchTab === "1v1" ? s.singles : s.doubles).slice(0, 8);
  const isMe = currentUser?.id === profile.id;

  return (
    <Page wide>
      <header className="flex items-center gap-4 mb-5">
        <Avatar email={profile.email} you={isMe} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="title truncate">{displayName(profile.email)}</h1>
          <p className="muted text-[0.9375rem]">{profile.region && profile.region !== "Global" ? profile.region : `${t("profile.profileId")} ${profile.profile_hash}`}</p>
        </div>
        {!isMe && (isFriend
          ? <span className="tag tag-win !py-2 !px-3"><Check size={16} /> {t("profile.onFriendsList")}</span>
          : <button onClick={handleAddFriend} className="btn btn-primary btn-sm"><UserPlus size={18} /> {t("profile.addFriend")}</button>)}
      </header>

      <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
        <CourtRating rating={profile.rating} rd={profile.rating_rd} caption={t("profile.duprRating")} t={t} />
        <section className="panel p-5 grid grid-cols-3 gap-4 md:flex md:flex-col md:justify-center md:gap-0">
          {[[t("profile.totalMatches"), s.total], [t("profile.wins"), s.wins], [t("profile.losses"), s.losses]].map(([label, value]) => (
            <div key={label} className="md:flex md:items-center md:justify-between md:py-3 md:border-t md:border-line md:first:border-t-0">
              <p className="text-[0.8125rem] muted">{label}</p>
              <p className="num text-[1.75rem] leading-tight">{value}</p>
            </div>
          ))}
        </section>
      </div>

      <div className="grid gap-6 mt-6 md:grid-cols-[1.25fr_1fr]">
        <section>
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2 className="heading">{t("dashboard.recentForm")}</h2>
            <div className="w-48"><Segmented label={t("dashboard.recentForm")} value={matchTab} onChange={setMatchTab}
              options={[{ value: "1v1", label: t("common.singles") }, { value: "2v2", label: t("common.doubles") }]} /></div>
          </div>
          {shown.length === 0 ? (
            <Empty>{matchTab === "1v1" ? t("profile.noSingles") : t("profile.noDoubles")}</Empty>
          ) : (
            <ul className="panel rows">
              {shown.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ResultTag win={m.win} t={t} />
                    <div>
                      <p className="num text-lg leading-tight">{m.myScore}–{m.theirScore}</p>
                      <p className="text-[0.8125rem] faint">{m.date}</p>
                    </div>
                  </div>
                  <Change value={m.change} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="heading mb-3">{t("profile.friendsRoster")} <span className="faint font-normal">{friends.length}</span></h2>
          {friends.length === 0 ? (
            <Empty>{t("friends.noFriends")}</Empty>
          ) : (
            <ul className="panel rows">
              {friends.map((f) => (
                <li key={f.id}>
                  <Link href={`/profile/${f.profile_hash}`} className="flex items-center gap-3 px-4 py-3 hover:bg-court-tint/50">
                    <Avatar email={f.email} you={f.id === currentUser?.id} />
                    <span className="font-semibold flex-1 truncate">{displayName(f.email)}</span>
                    <span className="num">{Number(f.rating).toFixed(3)}</span>
                    <ChevronRight size={18} className="faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Page>
  );
}
