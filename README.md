# Wellness League

Fantasy-football-style wellness leagues: create a league, invite friends, and log physical, mental and spiritual habits to earn points.

## Status

1. Done: daily log and leaderboard screens with the real scoring engine.
2. In progress: accounts, create a league, invite by link. Needs `supabase/schema.sql` and then `supabase/002_leagues_and_invites.sql` run once in the Supabase SQL Editor.
3. Next: save daily entries and show real standings.
4. Later: commissioner scoring settings.

The daily log and the leaderboard standings are still sample data; nothing is saved yet.

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
