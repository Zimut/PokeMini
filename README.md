# PokeMini

An online asynchronous PvP roguelike inspired by Pokémon (Gen 1), built for the browser. Think *The Bazaar* meets *Super Auto Pets* meets *Pokémon*.

## How to play locally

You need **Node.js 20+** (uses native ES modules and `node:test`-friendly features).

### Singleplayer only (no backend required)

```bash
node serve.js
```

Then open **http://localhost:8080** and click **Singleplayer Campaign**.

Singleplayer runs entirely client-side. It walks through all 7 gym leaders (Brock → Blaine), with the same Adventure / Town / Battle loop the Ranked mode uses.

### Full setup (Ranked + persistence + matchmaking)

```bash
# 1) Install server deps (one-time)
cd server && npm install && cd ..

# 2) Run the server on :3000
cd server && npm start

# 3) In another terminal, run the client on :8080
node serve.js
```

Open **http://localhost:8080** and choose **Ranked Match**. The client looks for the server at `http://localhost:3000` by default. You can override with a query string: `?server=http://your-host:3000`.

If the server is down, Ranked still works — the client falls back to the gym leader teams locally.

## Repository Layout

- `docs/` — Design and production documentation. Read this first.
  - `GDD.md` — Game Design Document. Source of truth for game rules and feel.
  - `ABILITIES.md` — Full list of Pokémon abilities (one per evolutionary line).
  - `TECH_STACK.md` — Tech choices and rationale.
  - `PRODUCTION.md` — Step-by-step instructions for the build agent.
  - `OPEN_QUESTIONS.md` — Resolved-decisions log.
- `client/` — Browser frontend. Plain HTML/CSS/JS, no framework. Single SPA.
  - `index.html`, `styles.css`
  - `src/data.js` — All species, abilities metadata, zones, items, gym leader teams.
  - `src/engine.js` — Deterministic battle engine. Runs unchanged in Node too.
  - `src/state.js` — Run state helpers (evolution, EXP, items).
  - `src/phases.js` — Title → starter → adventure → battle → town flow.
  - `src/ui.js` — HUD, tooltips, sprite URLs.
  - `src/api.js` — Server client (no-op if server is down).
  - `src/main.js` — Entry point.
- `server/` — Node + Fastify + SQLite. Endpoints listed in `TECH_STACK.md`.
- `db/` — SQLite schema and migrations.
- `serve.js` — Tiny static-file dev server. Zero dependencies.

## Implementation Notes

- **No bundler.** Native ES modules everywhere.
- **No frontend framework.** Plain DOM.
- **Sprites** load from `raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png` at runtime.
- **Battle engine** is deterministic given `(teamA, teamB, seed)` — the same module is used client-side for live play and (intended) server-side for replay validation.

## Status

- ✓ M1 — Data foundation (species, abilities, zones, items, gym leaders)
- ✓ M2 — Battle engine + all status effects + most abilities
- ✓ M3 — UI shell (Wii-inspired CSS, HUD, tooltips, drag-and-drop)
- ✓ M4 — Singleplayer run flow (all events, all items, evolution, gym leaders)
- ✓ M5 — Server skeleton (Fastify + SQLite, all endpoints)
- ✓ M6 — Async matchmaking (snapshot writes + gym leader fallback)
- ◯ M7 — Polish, full battle animation, balance pass

Some less-impactful abilities are stubbed (no-op) in the first build — see the `engine.js` ability dispatch for what's wired in. The 40+ abilities that drive the main team archetypes (Blaze, Static, Pungent Aura, Intimidate, Rocky Helmet, Pickup, Sniper, Shed Skin, Run Away, Healer, Tailwind, Will-O-Wisp, Vital Spirit, Cross Chop, Magic Guard, Yawn, Magnet Pull, Early Bird, Rest, Damp, Mimic, Imposter, Adaptability, Withdraw, Shell Armor, Mega Drain, Sky High, Predator, Disrupt, Discharge, Trample, Cloud Nine, Aftermath, Natural Cure, Constrict, Parental Bond, Toxic Spike, Predator's Mark, Flame Body, Vice Grip, Whale Song, Toxic Sweat, Solar Beam, Moxie, Coil, Stamina, Rivalry, Rollout, Hypnosis, Pungent Aura, Battle Armor, Limber, Iron Fist, Shed Skin) — all wired.
