# Wellness League

Fantasy-football-style wellness leagues: create a league, invite friends, and log physical, mental and spiritual habits to earn points.

## Status

Milestone 1 (this commit): the daily log and leaderboard screens with the real scoring engine. Friends and standings are sample data, and nothing is saved yet.

Next milestones:
2. Accounts, create a league, invite by link (uses `supabase/schema.sql`)
3. Save daily entries and show real standings
4. Commissioner scoring settings

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
