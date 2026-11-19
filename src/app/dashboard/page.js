"use client";
import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";
import { Page, Loading, CourtRating, Segmented, ResultTag, Change, Empty, displayName } from "../../components/ui";
import { summarize, locale } from "../../lib/matchHistory";
import { PROFILE_COLUMNS, MATCH_COLUMNS } from "../../lib/columns";

export default function Dashboard() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [matchTab, setMatchTab] = useState("1v1");

  const fetcher = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      throw new Error("Unauthorized");
    }
    const userId = session.user.id;
    const [profileRes, matchesRes] = await Promise.all([
      supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single(),
      supabase
        .from("matches")
        .select(MATCH_COLUMNS)
        .eq("counted", true)
        .or(`player_a_id.eq.${userId},team_a_player2_id.eq.${userId},team_b_player1_id.eq.${userId},team_b_player2_id.eq.${userId}`)
        .order("created_at", { ascending: true }),
    ]);
    return { user: session.user, profile: profileRes.data, matches: matchesRes.data || [] };
  };

  const { data, isLoading } = useSWR("user-dashboard", fetcher);
  if (isLoading) return <Loading text={t("common.loading")} />;
  if (!data) return null;

  const { user, profile, matches } = data;
  const s = summarize(matches, user.id, profile, language, t);
  const shown = (matchTab === "1v1" ? s.singles : s.doubles).slice(0, 8);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <Page wide>
      <p className="muted">{t("dashboard.hello")} {displayName(user.email)}</p>
      <h1 className="title mb-5">{t("dashboard.title")}</h1>

      <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
        <CourtRating rating={profile?.rating} rd={profile?.rating_rd} caption={t("dashboard.officialRating")} t={t} />

        <section className="panel p-5 grid grid-cols-3 gap-4 md:flex md:flex-col md:justify-center md:gap-0">
          {[
            [t("dashboard.matches"), s.total],
            [t("profile.wins"), s.wins],
            [t("dashboard.winRate"), `${s.winRate}%`],
          ].map(([label, value]) => (
            <div key={label} className="md:flex md:items-center md:justify-between md:py-3 md:border-t md:border-line md:first:border-t-0">
              <p className="text-[0.8125rem] muted">{label}</p>
              <p className="num text-[1.75rem] leading-tight">{value}</p>
            </div>
          ))}
        </section>
      </div>

      <section className="panel p-5 mt-4">
        <h2 className="heading">{t("dashboard.performanceHistory")}</h2>
        <p className="muted text-[0.9375rem] mt-0.5 mb-4">{t("dashboard.performanceHistorySub")}</p>
        <div className="h-56 md:h-72 -ml-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: "var(--color-court)", stopOpacity: 0.28 }} />
                  <stop offset="100%" style={{ stopColor: "var(--color-court)", stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis domain={["dataMin - 0.05", "dataMax + 0.05"]} fontSize={12} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => v.toFixed(2)} />
              <Tooltip
                cursor={{ stroke: "var(--color-ink-3)", strokeDasharray: "3 3" }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <div className="panel px-3 py-2 shadow-sm">
                      <p className="text-[0.8125rem] muted">{payload[0].payload.date}</p>
                      <p className="num text-lg">{payload[0].value.toFixed(3)}</p>
                      {payload[0].payload.score && <p className="text-[0.8125rem] muted">{payload[0].payload.score}</p>}
                    </div>
                  ) : null
                }
              />
              <Area type="monotone" dataKey="rating" strokeWidth={2.5} fill="url(#ratingFill)" activeDot={{ r: 5, fill: "#d7f03b", stroke: "#132238", strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="heading">{t("dashboard.recentForm")}</h2>
          <div className="w-48"><Segmented label={t("dashboard.recentForm")} value={matchTab} onChange={setMatchTab}
            options={[{ value: "1v1", label: t("common.singles") }, { value: "2v2", label: t("common.doubles") }]} /></div>
        </div>
        {shown.length === 0 ? (
          <Empty action={<button onClick={() => router.push("/")} className="btn btn-primary">{t("sidebar.logMatch")}</button>}>
            {matchTab === "1v1" ? t("dashboard.noSingles") : t("dashboard.noDoubles")}
          </Empty>
        ) : (
          <ul className="panel rows">
            {shown.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ResultTag win={m.win} t={t} />
                  <div className="min-w-0">
                    <p className="num text-lg leading-tight">{m.myScore}–{m.theirScore}</p>
                    <p className="text-[0.8125rem] faint">{m.date}{m.context === "tournament" ? `, ${t("events.status.tournament")}` : ""}</p>
                  </div>
                </div>
                <Change value={m.change} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <button onClick={signOut} className="btn btn-quiet w-full mt-8 md:hidden"><LogOut size={18} /> {t("sidebar.signOut")}</button>
    </Page>
  );
}
