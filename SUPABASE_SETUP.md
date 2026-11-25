# Supabase setup

The app uses Supabase guest authentication, Postgres, Row Level Security, and Realtime. No account or service-role key is needed in the browser.

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**.
3. Open **SQL Editor**, paste and run [`supabase/migrations/20261125000100_game_backend.sql`](./supabase/migrations/20261125000100_game_backend.sql).
4. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**.
5. Restart the Vite dev server and create a room. Invite players with its six-character code.

The SQL migration enables RLS, restricts secret roles and words to security-definer RPCs, and adds room/player/game tables to the `supabase_realtime` publication. Never put a Supabase service-role key in a `VITE_*` variable or browser code.

Guest identities are stored by Supabase in the browser session. Players can use a nickname without creating an account; clearing site data creates a new guest identity.

## Current game flow

The Classic mode supports guest lobbies, readiness, live player presence, role reveal, sequential clue rounds, private voting, multiple imposters, an optional final imposter guess, and results. The word bank is seeded by the migration. Rapid Fire and profile/game-history screens are not connected to a backend yet.

## Install as an app

The production build includes a web app manifest, an auto-updating service worker, and an **Install app** button in the header. Deploy over HTTPS (Vercel provides this automatically). Supported browsers show their native install prompt; Safari and other browsers without that prompt show instructions for installing from the browser menu. The app shell can load offline, but online multiplayer still needs an internet connection.
