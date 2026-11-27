# Supabase setup

The app uses Supabase guest authentication, Postgres, Row Level Security, and Realtime. No account or service-role key is needed in the browser.

1. Create a Supabase project.
2. In **Authentication → Sign In / Providers**, enable **Anonymous Sign-Ins**.
3. Open **SQL Editor** and run these files in order: [`supabase/migrations/20261125000100_game_backend.sql`](./supabase/migrations/20261125000100_game_backend.sql), [`supabase/migrations/20261127000100_rapid_fire_mode.sql`](./supabase/migrations/20261127000100_rapid_fire_mode.sql), [`supabase/migrations/20261127000200_rapid_fire_sequential_turns.sql`](./supabase/migrations/20261127000200_rapid_fire_sequential_turns.sql), then [`supabase/migrations/20261127000300_player_identity.sql`](./supabase/migrations/20261127000300_player_identity.sql).
4. Copy `.env.example` to `.env.local`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from **Project Settings → API**.
5. Restart the Vite dev server and create a room. Invite players with its six-character code.

The SQL migration enables RLS, restricts secret roles and words to security-definer RPCs, and adds room/player/game tables to the `supabase_realtime` publication. Never put a Supabase service-role key in a `VITE_*` variable or browser code.

Guest identities are stored by Supabase in the browser session. Players can use a nickname without creating an account; clearing site data creates a new guest identity. The player nickname and avatar are saved locally for future games and copied to each room through the player-identity migration. Uploaded photos are center-cropped and resized to 192×192 before being saved with the local profile and room player record.

## Player cards and role reveal

On first use, players create a persistent nickname and choose a built-in avatar or upload a PNG, JPEG, or WebP photo. The role card is private to the signed-in player: tapping reveals their own role, and **Hide role** flips it face-down again. Each player needs to open the game on their own device to reveal their own role. The current online room model intentionally does not send other players' secret roles to a shared phone.

## Current game flow

Classic supports guest lobbies, readiness, live player presence, role reveal, sequential clue turns, private voting, multiple imposters, an optional final imposter guess, and results. Rapid Fire also takes turns, but each player gives a one-word clue within 20 seconds; submitted clues stay visible so everyone can follow along. If a player runs out of time, their turn is skipped. The word bank is seeded by the initial migration. Profile/game-history screens are not connected to a backend yet.

## Install as an app

The production build includes a web app manifest, an auto-updating service worker, and an **Install app** button in the header. Deploy over HTTPS (Vercel provides this automatically). Supported browsers show their native install prompt; Safari and other browsers without that prompt show instructions for installing from the browser menu. The app shell can load offline, but online multiplayer still needs an internet connection.
