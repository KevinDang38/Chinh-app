// Turns a player's counted matches into stats, a rating chart and a match list.
// Uses the per-player rating changes stored on each match (rating_changes[userId]).

export const locale = (language) => (language === "vn" ? "vi-VN" : "en-US");

export function summarize(matches, userId, profile, language, t) {
  const loc = locale(language);
  let wins = 0;
  const singles = [];
  const doubles = [];
  const chart = [];

  const firstBefore = matches.find((m) => m.rating_changes?.[userId])?.rating_changes[userId].before;
  chart.push({ label: t("dashboard.start"), date: t("dashboard.start"), rating: Number(firstBefore ?? 3.5) });

  for (const m of matches) {
    const onA = m.player_a_id === userId || m.team_a_player2_id === userId;
    const myScore = onA ? m.player_a_score : m.player_b_score;
    const theirScore = onA ? m.player_b_score : m.player_a_score;
    const win = myScore > theirScore;
    if (win) wins++;
    const mine = m.rating_changes?.[userId];
    const d = new Date(m.created_at);
    const row = {
      id: m.id,
      win,
      myScore,
      theirScore,
      change: mine?.change ?? null,
      context: m.context,
      date: d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" }),
    };
    (m.match_type === "2v2" ? doubles : singles).push(row);
    if (mine) chart.push({ label: d.toLocaleDateString(loc, { day: "numeric", month: "short" }), date: row.date, rating: Number(mine.after), score: `${myScore}–${theirScore}` });
  }

  if (chart.length === 1) chart.push({ ...chart[0], rating: Number(profile?.rating ?? 3.5) });

  const total = matches.length;
  return {
    wins,
    losses: total - wins,
    total,
    winRate: total ? Math.round((wins / total) * 100) : 0,
    singles: singles.reverse(),
    doubles: doubles.reverse(),
    chart,
  };
}
