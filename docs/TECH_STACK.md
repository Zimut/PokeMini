# PokeMini — Tech Stack

Guiding constraint: **a single small VPS must serve thousands of players**. PvP is asynchronous, so the server's main job is to read and write small JSON blobs. No realtime sockets, no heavy frameworks.

## Frontend

- **Plain HTML + CSS + vanilla JavaScript (ES2022 modules).** No React, no Vue.
  - Total JS payload target: **< 200 KB minified** (excluding sprites, which load from CDN).
  - One single-page application; phases are rendered by swapping container DOM.
- **CSS** hand-written. Light use of CSS variables for the Wii-inspired palette.
- **Sprite assets:** loaded by URL from **PokéAPI sprite repos** (e.g. `raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png`). Cached in browser. Item icons from a similar open repository — see `assets/INSTRUCTIONS.md`.
- **Data tables:** Gen 1 base stats, type chart, and learnsets are checked in as small JSON in `client/src/data/`. They never change at runtime, so they're bundled, not fetched.

## Backend

- **Node.js + Fastify** (or vanilla `http`). Fastify is fine — small footprint, fast JSON.
  - Stateless except for a database connection pool.
  - Endpoints, all `POST` with a single JSON body:
    - `POST /run/start` — create a run, returns initial state seed.
    - `POST /run/advance` — submit current run state delta after an Adventure step; server validates and persists.
    - `POST /pvp/match` — request an opponent snapshot for `(zone, badges, strikes, elo)`.
    - `POST /pvp/result` — submit deterministic battle outcome + seed; server validates by replay, updates ELO and snapshot.
    - `POST /shop/town` — request the 3 item rolls for the current Town visit (server-rolled to prevent client manipulation).
- **Determinism:** All RNG (event rolls, encounter rolls, town rolls, battle ties) is **server-seeded** with seeds returned to the client. Battles are simulated on both sides; the server replays to validate before granting badges / ELO.
- **Sessions:** A simple opaque player token (UUID) stored in `localStorage`. No accounts.

## Database

- **SQLite** for v0 (single file on the VPS, served via `better-sqlite3`). Cheap, fast, fits thousands of concurrent players for our write volume.
- Migrate to **PostgreSQL** only if we cross ~10k DAU.

### Tables (v0)

```
players (id, name, elo, created_at, last_seen)
runs    (id, player_id, started_at, ended_at, result, zone, badges, strikes, money, elo_delta)
teams   (run_id, slot, species_id, level, hp, atk, spd, ability_id, type1, type2, fainted)
items   (run_id, slot, item_id)
snapshots(zone, badges, strikes, elo_bucket, run_id, team_json, created_at)
```

`snapshots` is the matchmaking table. `team_json` is a compact serialization of the full team state, including ability state. Snapshots are indexed by `(zone, badges, strikes, elo_bucket)`. Older than 24h: tombstone.

## Hosting

- **VPS:** 1 vCPU / 1 GB RAM is enough for v0.
- **CDN:** sprites are served by GitHub raw or jsDelivr (free). Static frontend is served by the same VPS via Nginx, or pushed to Cloudflare Pages (also free).
- **TLS:** Caddy on the VPS for one-line HTTPS, or Cloudflare in front.

## Battle Engine

- Implemented **once**, in TypeScript or pure JavaScript, runnable both **client-side** (for live animation) and **server-side** (for validation). Same module imported by both.
- Deterministic given `(teamA, teamB, seed)`. No `Math.random()` outside of a seeded RNG class.
- Battles run to completion in **microseconds** on server; logs are sent to the client with timestamps for animation pacing.

## Build & Tooling

- **No bundler required.** Use native ES modules. If a bundler becomes necessary, prefer **esbuild** for speed.
- **TypeScript** is recommended but optional. If used, output JS modules directly.
- **No frontend framework.** Templating is plain DOM API.
- **Linting:** `eslint` with a minimal config.
- **Tests:** `node:test` for the battle engine. Unit-test ability triggers exhaustively.

## What we are explicitly NOT using

- React / Vue / Angular / Svelte.
- WebSockets.
- Redis.
- A separate game-state server.
- Webpack.
- Service workers (for v0).
- User accounts with passwords.
