# PokeMini — Production Instructions

Audience: an autonomous build agent (Opus 4.7) tasked with implementing PokeMini from the docs in this folder.

> Read order before writing any code: `GDD.md` → `TECH_STACK.md` → `ABILITIES.md` → this file → `OPEN_QUESTIONS.md`. If `OPEN_QUESTIONS.md` lists a decision you need, **stop and ask the designer** rather than guess.

---

## 1. Build Order

Implement in this strict order. Each milestone is a working, testable artifact.

### M1 — Data foundation (no UI yet)
- Bundle Gen 1 base stats and type chart as JSON in `client/src/data/`.
- Bundle ability definitions (id, trigger, scaling) in `client/src/data/abilities.json`. Validate against `ABILITIES.md`.
- Bundle zone definitions and species pools in `client/src/data/zones.json`.

### M2 — Battle engine (pure)
- Implement `client/src/engine/battle.ts` (or `.js`) as a deterministic function `simulate(teamA, teamB, seed) → log[]`.
- Implement every ability listed in `ABILITIES.md`. One unit test per ability covering its trigger.
- Implement the type chart (Gen 2+ corrected unless decision flipped — see `OPEN_QUESTIONS.md` #4).
- No DOM access. Engine must run identically in Node.

### M3 — UI shell
- Single-page HTML with phase containers: starter pick, adventure, town, pvp.
- Wii-inspired CSS palette and typography. **No emojis. Titles only — no tutorial text anywhere.**
- HUD: team layout (3 front × 3 back), 3 item slots, top bar (name, rank, badges, strikes, money), phase header.
- Tooltip system (`mouseenter` for desktop, `touchstart` + hold for mobile).

### M4 — Singleplayer Gym Leader Campaign (first fully playable build)
This is the primary v0 testing surface. It runs entirely client-side and does not require the backend. Progression is **identical to Ranked** — same 7 zones, same 5-badges-to-win, same 3-strikes-to-lose, same max-7-rounds.
- Implement Initial → Adventure → Battle → Town loop offline.
- Implement all events (Wild Encounter, Trainer Battle, Berry Gathering, Trading, PokéCenter), including the step-1 / step-5 constraints.
- Implement all 9 items with drag-and-drop targets.
- Implement evolution by level threshold and by Evosoda.
- **Author the 7 gym leader teams** listed in `GDD.md §5.2` (Brock through Blaine), each scaled to its zone level (8 / 16 / 24 / 32 / 40 / 48 / 56). These same 7 teams are reused in M6 as the Ranked cold-start fallback.
- Author the 7 themed zone pools (Pewter / Cerulean / Vermilion / Celadon / Fuchsia / Saffron / Cinnabar) — these are also the Ranked zone pools.
- Run completion: 5 badges = win, 3 strikes = loss. No ELO writes.
- A "Start Run" screen lets the player pick Singleplayer (and, after M6, Ranked).

### M5 — Server + persistence
- Bring up Node + Fastify + SQLite per `TECH_STACK.md`.
- Implement endpoints listed in `TECH_STACK.md`.
- Persist players, runs, teams, items, ELO. Singleplayer run history is persisted but writes no ELO.
- Server-side battle replay validates Ranked results before applying ELO and badges. (Singleplayer is client-authoritative — there's nothing to cheat against.)

### M6 — Async matchmaking (Ranked Mode online)
- Write opponent snapshots to the `snapshots` table at each Ranked PvP request.
- Match on `(zone, badges, strikes, elo_bucket)`, prefer fresh (< 24h) snapshots.
- **Cold-start fallback reuses the gym leader teams already authored in M4** — stages 1–7 (Brock through Blaine) map to zones 1–7. Giovanni is Singleplayer-only.

### M7 — Polish
- Battle log animation pacing on the client (replay the server-validated log with time deltas).
- Rank tier icons (Poké/Great/Ultra/Master × 1–4).
- Drag-and-drop polish (visual feedback, invalid-target rejection).
- Mobile breakpoint tuning.

---

## 2. Folder Structure

Create exactly this layout. Do not introduce additional top-level folders without updating this file and the relevant `INSTRUCTIONS.md`.

```
PokeMini/
├── README.md
├── docs/
│   ├── GDD.md
│   ├── ABILITIES.md
│   ├── TECH_STACK.md
│   ├── PRODUCTION.md
│   └── OPEN_QUESTIONS.md
├── client/
│   ├── INSTRUCTIONS.md
│   ├── index.html
│   ├── src/
│   │   ├── data/        (bundled JSON)
│   │   ├── engine/      (battle engine, runs in browser AND node)
│   │   ├── phases/      (one module per phase: starter, adventure, pvp, town)
│   │   ├── ui/          (HUD, tooltips, drag-and-drop)
│   │   └── net/         (thin client for server endpoints)
│   └── styles/
├── server/
│   ├── INSTRUCTIONS.md
│   ├── src/
│   │   ├── index.ts
│   │   ├── routes/
│   │   ├── matchmaking.ts
│   │   ├── replay.ts     (imports client/src/engine for validation)
│   │   └── elo.ts
│   └── package.json
├── db/
│   ├── INSTRUCTIONS.md
│   ├── schema.sql
│   └── migrations/
└── assets/
    └── INSTRUCTIONS.md
```

The battle engine must be importable by both `client/` and `server/`. Either keep it in `client/src/engine/` and have the server import via a relative path, or factor it into a shared `engine/` workspace if the build agent prefers — but a single source of truth is non-negotiable.

---

## 3. Implementation Rules

- **Deterministic RNG.** All randomness comes from a seeded RNG (`xoshiro256**` or `mulberry32`). Never call `Math.random()` outside of seeding.
- **Server is the authority.** The client may animate optimistically, but ELO, badges, strikes, money, and inventory deltas only commit after server validation.
- **Visual style locks.**
  - Palette: soft whites, muted blues, cream/sand neutrals. Reference: Wii Menu, Mii Channel, Wii Shop Channel.
  - Font: simple humanist sans-serif (Inter, Nunito, or system default).
  - **No emojis anywhere in UI, copy, or commit messages.**
  - **No tutorial text anywhere.** Titles only. Tooltips on hover/tap are the only place explanations exist.
- **Mobile parity.** Drag-and-drop must work via touch. Tooltips trigger on tap-and-hold (~300 ms).
- **Performance budgets.**
  - Initial JS payload: < 200 KB minified.
  - Time-to-first-interaction on mid-range mobile: < 2 s on 4G.
  - Server response: < 50 ms p99 for all endpoints under expected load.
- **Sprite loading.** Lazy-load by Pokémon ID from the public sprite repo. Cache aggressively via standard browser cache headers; do not bundle binaries.

---

## 4. Roster Data the Agent Must Produce

These tables are referenced by the GDD but not embedded — generate them as JSON during M1:

- **Species stats table** for every Gen 1 Pokémon (id 1–151): `{ id, name, types[1..2], hp, atk, spd, evolution_level, evolves_to }`.
- **Evolutions table** (`client/src/data/evolutions.json`) covering canonical level evolutions, trade evolutions remapped to levels, and stone evolutions remapped to levels (decision #2). Eevee → Vaporeon only (decision #1).
- **Ability table** matching `ABILITIES.md` exactly: `{ id, name, trigger, stage_values, description }`.
- **Zone table:** 7 entries, each with `{ id, name, level, species_pool[], trainer_pool[], gym_leader_fallback }`. Use the draft in `GDD.md §6.5` and the gym leader mapping in `GDD.md §5`.
- **Trainer archetype table:** at least one per zone. Sample roster, from canon — zones now follow the gym-leader regions (see `GDD.md §6.5`):
  - Zone 1 (Pewter / Mt. Moon, Rock): *Youngster* (Rattata, Spearow), *Bug Catcher* (Caterpie, Weedle, Metapod), *Hiker* (Geodude, Sandshrew, Onix-rare).
  - Zone 2 (Cerulean / Rock Tunnel, Water): *Swimmer* (Tentacool, Shellder, Krabby), *Fisherman* (Goldeen, Magikarp, Horsea), *Hiker* (Onix, Geodude, Machop).
  - Zone 3 (Vermilion / Power Plant, Electric): *Sailor* (Machop, Tentacool, Krabby), *Engineer* (Voltorb, Magnemite), *Rocker* (Voltorb, Electrode).
  - Zone 4 (Celadon / Lavender, Grass): *Beauty* (Oddish, Bellsprout, Exeggcute), *Channeler* (Gastly, Haunter), *Pokémaniac* (Cubone, Slowpoke).
  - Zone 5 (Fuchsia / Safari Zone, Poison): *Rocket Grunt* (Koffing, Grimer, Ekans), *Juggler* (Drowzee, Voltorb-rare), *Tamer* (Tauros, Sandslash, Pinsir).
  - Zone 6 (Saffron / Dojo, Psychic): *Psychic* (Abra, Kadabra, Mr. Mime), *Black Belt* (Hitmonlee, Hitmonchan, Machoke), *Juggler* (Drowzee, Hypno).
  - Zone 7 (Cinnabar / Pokémon Mansion, Fire): *Burglar* (Vulpix, Growlithe, Grimer, Koffing), *Super Nerd* (Magmar, Ditto, Porygon), *Bird Keeper* (Doduo, Dodrio, Fearow), *Cooltrainer* (mixed elite from the zone pool).

---

## 5. Testing Requirements

- **Unit tests** for every ability trigger (M2).
- **Unit tests** for the type chart, including a regression test for the Gen 1 Ghost/Psychic bug (verifying the *corrected* behaviour ships).
- **Integration test** simulating a full run end-to-end with a fixed seed; assert the same final state on rerun.
- **Replay test** on the server: a known battle log replays to the same final state.

---

## 6. What to Hand Back

When the agent finishes a milestone, output:

1. A brief changelog (one paragraph per milestone, no marketing voice).
2. Updated `OPEN_QUESTIONS.md` reflecting any answers that came up during build.
3. A list of any **design decisions** the agent had to make alone, so the designer can review them.

---

## 7. Do Not

- Do not add new mechanics that aren't in `GDD.md`.
- Do not add user accounts, social features, monetization, or analytics in v0.
- Do not pull in a frontend framework.
- Do not host or proxy any content that isn't sprite data from the public repos listed in `assets/INSTRUCTIONS.md`.
- Do not write any tutorial / instructional copy in the UI.
- Do not use emojis anywhere — including code comments, commit messages, and Slack-style status updates.
