# db/

SQLite for v0. One file (`pokemini.db`), checked in via `schema.sql`.

- `schema.sql` — full DDL, kept in sync with `TECH_STACK.md`.
- `migrations/` — one numbered SQL file per migration. Migrations are forward-only.

**Tables (v0)**
- `players(id, name, elo, created_at, last_seen)`
- `runs(id, player_id, started_at, ended_at, result, zone, badges, strikes, money, elo_delta)`
- `teams(run_id, slot, species_id, level, hp, atk, spd, ability_id, type1, type2, fainted)`
- `items(run_id, slot, item_id)`
- `snapshots(zone, badges, strikes, elo_bucket, run_id, team_json, created_at)`

**Indexes that matter**
- `snapshots(zone, badges, strikes, elo_bucket, created_at DESC)` — matchmaking hot path.
- `players(elo DESC)` — leaderboards.

Snapshots older than 24h should be tombstoned by a background cleanup (cron or on-write). Do not store binary blobs in SQLite.
