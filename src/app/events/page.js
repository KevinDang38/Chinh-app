"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Users, Search } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";
import { Page, PageHeader, Loading, Empty, displayName } from "../../components/ui";
import { statusLabel, statusTag, isDoublesEvent } from "../../lib/eventStatus";
import { locale } from "../../lib/matchHistory";

export default function EventsList() {
  const { t, language } = useLanguage();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from("events").select("*, event_participants(status)").order("begin_date", { ascending: true });
      if (data?.length) {
        const hostIds = [...new Set(data.map((e) => e.host_id).filter(Boolean))];
        const { data: hosts } = hostIds.length ? await supabase.from("profiles").select("id, display_name").in("id", hostIds) : { data: [] };
        setEvents(data.map((ev) => ({
          ...ev,
          approvedCount: (ev.event_participants || []).filter((p) => p.status === "approved").length,
          host_name: hosts?.find((p) => p.id === ev.host_id)?.display_name || null,
        })));
      }
      setLoading(false);
    };
    fetchEvents();
  }, []);

  const q = searchQuery.toLowerCase();
  const filtered = events.filter((e) => e.title?.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q));
  const loc = locale(language);

  if (loading) return <Loading text={t("common.loading")} />;

  return (
    <Page wide>
      <PageHeader title={t("events.list.title")} sub={t("events.list.sub")} />

      <div className="relative mb-5 md:max-w-sm">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 faint pointer-events-none" />
        <label htmlFor="event-search" className="sr-only">{t("events.list.searchLabel")}</label>
        <input id="event-search" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("events.list.searchPlaceholder")} className="field !pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Empty>{t("events.list.noEvents")}</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((ev) => {
            const d = ev.begin_date ? new Date(ev.begin_date) : null;
            return (
              <li key={ev.id}>
                <Link href={`/events/${ev.id}`} className="panel flex gap-4 p-4 h-full hover:border-ink-3 transition-colors">
                  {/* date ticket */}
                  <div className="w-16 shrink-0 rounded-xl bg-court-tint text-court-text flex flex-col items-center justify-center py-2">
                    <span className="text-[0.75rem] font-semibold">{d ? d.toLocaleDateString(loc, { month: "short" }) : "—"}</span>
                    <span className="num text-[1.75rem] leading-none">{d ? d.getDate() : "?"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`tag ${statusTag(ev.status)}`}>{statusLabel(ev.status, t)}</span>
                      <span className="text-[0.8125rem] faint">{isDoublesEvent(ev) ? t("common.doubles") : t("common.singles")}</span>
                    </div>
                    <h2 className="heading truncate">{ev.title}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.875rem] muted">
                      {ev.location && <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={15} className="shrink-0" /><span className="truncate">{ev.location}</span></span>}
                      <span className="inline-flex items-center gap-1"><Users size={15} />{ev.approvedCount}/{ev.max_players || "∞"}</span>
                    </div>
                    {ev.host_name && <p className="text-[0.8125rem] faint mt-1">{t("events.details.hostedBy")} {displayName(ev.host_name)}</p>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}
