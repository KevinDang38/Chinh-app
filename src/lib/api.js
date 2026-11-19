// One way to call the submit-match server function. Throws an Error with .code (e.g. "cooldown").
import { supabase } from "./supabaseClient";

export async function callServer(body) {
  const { data, error } = await supabase.functions.invoke("submit-match", { body });
  if (error) throw Object.assign(new Error(error.message), { code: "network" });
  if (data?.error) throw Object.assign(new Error(data.error), { code: data.code, wait: data.wait });
  return data;
}

/** A readable, translated message for a server error. */
export function errorText(err, t) {
  if (err.code === "cooldown") return t("alerts.cooldown").replace("{n}", err.wait);
  if (err.code === "invalid_score") return t("alerts.invalidPickleballScore");
  if (err.code === "teams_stale") return t("events.teams.stale");
  if (err.code === "forbidden") return t("alerts.notAllowed");
  return `${t("alerts.somethingWrong")} ${err.message}`;
}
