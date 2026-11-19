# Chình

Pickleball match logging, ratings and events, in English and Vietnamese.
Live at https://chinh-app.vercel.app

## What it does

- **Log a match**: enter a singles or doubles score yourself, or host a live lobby that friends join with a 4-digit PIN.
- **Ratings**: every player has a rating (DUPR scale, starts at 3.5) and a confidence value. New or inactive players move fast; regulars move slowly.
- **Events**: hosts create open play or tournaments, approve players, and run a bracket. Doubles teams are paired automatically (strongest with weakest) and can be swapped before the bracket starts.
- **Friends and profiles**: add friends by email, compare ratings, see match history.

## Stack

- Next.js 16 (App Router, client pages) + Tailwind CSS 4, deployed on Vercel from `main`
- Supabase: Postgres, auth, realtime (live lobbies) and one edge function, `submit-match`
- Font: Archivo (self-hosted via `@fontsource-variable/archivo`)

## Project layout

```
src/app/                 pages (log match, dashboard, events, friends, profile, login)
src/components/ui.js     shared UI: court rating tile, score stepper, sheets, dialogs
src/components/Sidebar.js  bottom tabs on mobile, rail on desktop
src/lib/                 api helper, columns the app may read, theme, match history
src/dictionaries/        en.json, vn.json
supabase/functions/submit-match/
  index.ts               router: casual match, guest claim, teams.*, bracket.*
  match.ts               recording matches, 8-minute cooldown, guest claims
  actions.ts             tournament actions (host only)
  bracket.ts             bracket + team logic (pure)
  rating.ts              rating engine (pure)
  rating.test.ts         tests
supabase/migrations/     record of database changes
```

## Rating rules

`supabase/functions/submit-match/rating.ts` is the single source of truth.

- Glicko-style: change = (actual − expected) × how much the player may move. That allowance depends on the player's uncertainty and the match weight.
- Actual result = 70% win/loss + 30% share of points.
- Weights: tournament 1.25×, game to 15 1.15×, game to 21 1.3×.
- Doubles: each partner's expectation sits between their own rating and the team average.
- Valid games: to 11, 15 or 21, win by 2. Guests play as an unknown 3.5.
- Casual matches: at least 8 minutes between matches for the same player.

Only the server writes ratings, matches and brackets. The browser cannot read emails (players are shown by `display_name`).

## Develop

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and anon key
npm run dev
```

Lint: `npm run lint`
Rating/bracket tests (needs Deno): `deno test supabase/functions/submit-match/`

The edge function is deployed separately from the app (Supabase dashboard, CLI or MCP). Changes under `supabase/functions` do not deploy with Vercel.
