# Own Your Day

Fantasy-football-style wellness leagues: create a league, invite friends, and log physical, mental and spiritual habits to earn points.

## Status

1. Done: accounts, create a league, invite by link. Needs `supabase/schema.sql` and then `supabase/002_leagues_and_invites.sql` run once in the Supabase SQL Editor.
2. In testing: personal tracking (saved daily entries, Personal tab with trends, streaks and calendar). Needs `supabase/003_personal_tracking.sql`.
3. In testing: custom point values for your own Personal stats (Daily log, then Customize points), a Leagues tab with real standings and the invite link, and an Account tab. Needs `supabase/004_custom_scoring.sql`.
4. In testing: league chart and day picker, weekly matchups and records, weekly recap awards, season totals, past weeks, reactions, activity feed, team goals and owner-set league scoring. Needs `supabase/005_league_features.sql`.
5. Next: streak bonus in standings, notifications.
6. Open question: running vs steps double counting.

## Environment variables

Set these in Vercel (see `.env.example`):
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
Without them the app runs as a demo with no sign-in.

## Scoring

All rules live in `src/lib/scoring.ts` and are covered by tests in `src/lib/scoring.test.ts`.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # scoring tests
```

## Stack

Next.js (website), Supabase (database and logins), Vercel (hosting).
