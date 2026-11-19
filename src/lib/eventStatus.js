// Shared event status / format helpers for the events pages.
export const normalizeStatus = (s) => {
  const v = (s || "").toLowerCase();
  if (v === "upcoming" || v === "registration" || !v) return "registration";
  return v; // registration_closed | live | completed
};

export const statusLabel = (s, t) =>
  ({ registration: t("events.status.open"), registration_closed: t("events.status.closed"), live: t("events.status.live"), completed: t("events.status.completed") })[normalizeStatus(s)];

export const statusTag = (s) =>
  ({ registration: "tag-win", registration_closed: "tag-neutral", live: "tag-volt", completed: "tag-neutral" })[normalizeStatus(s)];

export const isDoublesEvent = (ev) => (ev?.format || ev?.event_type || "").toLowerCase() === "doubles";
