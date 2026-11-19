"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { useLanguage } from "../../../context/LanguageContext";
import { Page, PageHeader, Segmented } from "../../../components/ui";

function Field({ id, label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="text-[0.8125rem] faint">{hint}</p>}
    </div>
  );
}

export default function HostEvent() {
  const router = useRouter();
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/login");
      else setCurrentUser(session.user);
    });
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setError("");
    if (maxPlayers && parseInt(maxPlayers) % 2 !== 0) return setError(t("events.create.error_even_players"));
    if (endDate && beginDate && endDate < beginDate) return setError(t("events.create.error_dates"));

    setLoading(true);
    const { data: eventData, error: eventError } = await supabase.from("events").insert([{
      host_id: currentUser.id,
      title,
      event_type: eventType,
      format,
      date_time: beginDate,
      begin_date: beginDate,
      end_date: endDate,
      region,
      location,
      min_dupr: minDupr ? parseFloat(minDupr) : 0,
      max_dupr: maxDupr ? parseFloat(maxDupr) : 8.0,
      max_players: maxPlayers ? parseInt(maxPlayers) : null,
      entry_fee: entryFee || t("events.create.free"),
      status: "registration",
    }]).select().single();
    setLoading(false);

    if (eventError) setError(`${t("events.create.error_create")} ${eventError.message}`);
    else router.push(`/events/${eventData.id}`);
  };

  return (
    <Page>
      <PageHeader title={t("events.create.title")} sub={t("events.create.subtitle")} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <section className="panel p-5 flex flex-col gap-4">
          <h2 className="heading">{t("events.create.basicDetails")}</h2>
          <Field id="title" label={t("events.create.event_title")}>
            <input id="title" type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("events.create.titlePlaceholder")} className="field" />
          </Field>
          <Field id="type" label={t("events.create.event_type")}>
            <Segmented label={t("events.create.event_type")} value={eventType} onChange={setEventType}
              options={[{ value: "tournament", label: t("events.create.type_tournament") }, { value: "open_play", label: t("events.create.type_open") }]} />
          </Field>
          <Field id="format" label={t("events.create.format")}>
            <Segmented label={t("events.create.format")} value={format} onChange={setFormat}
              options={[{ value: "singles", label: t("events.create.singles") }, { value: "doubles", label: t("events.create.doubles") }]} />
          </Field>
        </section>

        <section className="panel p-5 flex flex-col gap-4">
          <h2 className="heading">{t("events.create.logisticsTime")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field id="begin" label={t("events.create.begin_date")}>
              <input id="begin" type="date" required value={beginDate} onChange={(e) => setBeginDate(e.target.value)} className="field" />
            </Field>
            <Field id="end" label={t("events.create.end_date")}>
              <input id="end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" />
            </Field>
          </div>
          <Field id="location" label={t("events.create.location")}>
            <input id="location" type="text" required value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("events.create.locationPlaceholder")} className="field" />
          </Field>
          <Field id="region" label={t("events.create.region")}>
            <input id="region" type="text" required value={region} onChange={(e) => setRegion(e.target.value)} placeholder={t("events.create.regionPlaceholder")} className="field" />
          </Field>
          <Field id="fee" label={t("events.create.entryFeeOptional")} hint={t("events.create.paymentDisclaimer")}>
            <input id="fee" type="text" value={entryFee} onChange={(e) => setEntryFee(e.target.value)} placeholder={t("events.create.feePlaceholder")} className="field" />
          </Field>
        </section>

        <section className="panel p-5 flex flex-col gap-4">
          <h2 className="heading">{t("events.create.restrictionsLimits")}</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field id="min" label={t("events.create.min_dupr")}>
              <input id="min" type="number" inputMode="decimal" step="0.001" min="0" max="8" value={minDupr} onChange={(e) => setMinDupr(e.target.value)} placeholder="0.000" className="field num !text-base" />
            </Field>
            <Field id="max" label={t("events.create.max_dupr")}>
              <input id="max" type="number" inputMode="decimal" step="0.001" min="0" max="8" value={maxDupr} onChange={(e) => setMaxDupr(e.target.value)} placeholder="8.000" className="field num !text-base" />
            </Field>
            <Field id="players" label={t("events.create.max_players")}>
              <input id="players" type="number" inputMode="numeric" min="2" step="2" value={maxPlayers} onChange={(e) => setMaxPlayers(e.target.value)} placeholder={t("events.create.openPlayers")} className="field num !text-base" />
            </Field>
          </div>
        </section>

        {error && <p role="alert" className="text-loss">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">{loading ? <span className="spinner !border-white/30 !border-t-white" /> : t("events.create.publish_btn")}</button>
      </form>
    </Page>
  );
}
