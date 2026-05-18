// Seed the matchmaking pool with fake player snapshots so the server has data to
// match against when the real playerbase is small. Three fake "players" each carry
// a progressing team across all 7 zones (21 snapshots total), spread across ELO
// brackets so the matchmaker's widening search has something at any tier.
//
// Run from the repo root on the VPS:
//   sudo -u pokemini node server/scripts/seed-snapshots.js
//
// Idempotent-ish: re-running adds another 21 snapshots. To wipe and re-seed:
//   sudo -u pokemini sqlite3 /home/pokemini/PokeMini/db/pokemini.db \
//     "DELETE FROM snapshots WHERE player_name IN ('Crimson','Marina','Mossblade')"
//   sudo -u pokemini node server/scripts/seed-snapshots.js

import Database from 'better-sqlite3';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.POKEMINI_DB || path.resolve(__dirname, '../../db/pokemini.db');
const db = new Database(DB_PATH);

const now = Date.now();
const bucket = (elo) => Math.floor(elo / 100);

const insert = db.prepare(`INSERT INTO snapshots
  (zone, badges, strikes, elo_bucket, run_id, player_name, team_json, created_at)
  VALUES (?, ?, ?, ?, NULL, ?, ?, ?)`);

// Players-table upsert so the fake names also appear in the leaderboard. ELO
// uses the player's highest-zone snapshot ELO (final-run value). Country gives
// each fake a distinct flag in the leaderboard for visual variety. Idempotent —
// re-running tops up ELO + country if changed but doesn't duplicate names.
const upsertPlayer = db.prepare(`INSERT INTO players
  (id, name, elo, country, created_at, last_seen, claim_token)
  VALUES (@id, @name, @elo, @country, @ts, @ts, NULL)
  ON CONFLICT(id) DO UPDATE SET
    elo = excluded.elo,
    country = excluded.country,
    last_seen = excluded.last_seen`);
const findPlayerByName = db.prepare(`SELECT * FROM players WHERE name = ? COLLATE NOCASE`);

// Helper: build a roster entry. Slot, level, species required; rest defaulted by the engine.
const m = (speciesId, level, slot) => ({ speciesId, level, slot });

// ─── Fake player 1: Crimson (fire-leaning, lower-to-mid bracket) ────────────
// Starter Charmander → Charmeleon (L16) → Charizard (L36). Picks up rock/normal
// utility along the way. Solid generalist build.
const crimsonRuns = [
  { zone:1, badges:0, elo: 50, team:[
    m(4, 7, 'F2'),       // Charmander
    m(74, 5, 'F1'),      // Geodude
    m(16, 7, 'F3'),      // Pidgey
    m(19, 6, 'B2'),      // Rattata
  ]},
  { zone:2, badges:1, elo: 120, team:[
    m(5, 13, 'F2'),      // Charmeleon (evolved at 16? actually 16; lvl 13 still Charm) — adjust: still Charm
    m(74, 12, 'F1'),     // Geodude
    m(16, 13, 'F3'),     // Pidgey
    m(19, 12, 'B2'),     // Rattata
    m(95, 12, 'B1'),     // Onix
  ]},
  { zone:3, badges:2, elo: 220, team:[
    m(5, 20, 'F2'),      // Charmeleon
    m(74, 19, 'F1'),     // Geodude
    m(17, 20, 'F3'),     // Pidgeotto (Pidgey evolved at 18)
    m(20, 20, 'B2'),     // Raticate (Rattata evolved at 20)
    m(95, 20, 'B1'),     // Onix
    m(37, 19, 'B3'),     // Vulpix
  ]},
  { zone:4, badges:3, elo: 340, team:[
    m(5, 27, 'F2'),      // Charmeleon
    m(75, 27, 'F1'),     // Graveler (Geodude evolved at 25)
    m(18, 27, 'F3'),     // Pidgeot (Pidgeotto evolved at 36? actually 36 — still Pidgeotto)
    m(20, 27, 'B2'),     // Raticate
    m(95, 27, 'B1'),     // Onix
    m(37, 27, 'B3'),     // Vulpix
  ]},
  { zone:5, badges:4, elo: 460, team:[
    m(5, 34, 'F2'),      // Charmeleon (still — evolves at 36)
    m(75, 34, 'F1'),     // Graveler
    m(17, 34, 'F3'),     // Pidgeotto
    m(20, 34, 'B2'),     // Raticate
    m(95, 34, 'B1'),     // Onix
    m(38, 35, 'B3'),     // Ninetales (Vulpix evolved at 35)
  ]},
  { zone:6, badges:5, elo: 590, team:[
    m(6, 41, 'F2'),      // Charizard (evolved at 36)
    m(76, 41, 'F1'),     // Golem (Graveler→Golem at 38)
    m(18, 41, 'F3'),     // Pidgeot (evolved at 36)
    m(20, 41, 'B2'),     // Raticate
    m(95, 41, 'B1'),     // Onix
    m(38, 41, 'B3'),     // Ninetales
  ]},
  { zone:7, badges:6, elo: 750, team:[
    m(6, 48, 'F2'),      // Charizard
    m(76, 48, 'F1'),     // Golem
    m(18, 48, 'F3'),     // Pidgeot
    m(143, 48, 'B2'),    // Snorlax (replaced Raticate from Z6 special event)
    m(95, 48, 'B1'),     // Onix
    m(38, 48, 'B3'),     // Ninetales
  ]},
];

// ─── Fake player 2: Marina (water-leaning, mid-to-high bracket) ─────────────
// Starter Squirtle → Wartortle → Blastoise. Aggressive trader, swaps in big
// finds across zones. Higher ELO from clean runs.
const marinaRuns = [
  { zone:1, badges:0, elo: 75, team:[
    m(7, 7, 'F2'),       // Squirtle
    m(10, 6, 'F1'),      // Caterpie
    m(46, 5, 'F3'),      // Paras
    m(140, 6, 'B2'),     // Kabuto (rare cap)
  ]},
  { zone:2, badges:1, elo: 180, team:[
    m(8, 13, 'F2'),      // Wartortle (Squirtle evolved at 16... no still Squirtle at 13)
    m(11, 12, 'F1'),     // Metapod (Caterpie→Metapod at 7)
    m(47, 13, 'F3'),     // Parasect (Paras→Parasect at 24 — still Paras at 13)
    m(140, 13, 'B2'),    // Kabuto
    m(129, 13, 'B1'),    // Magikarp
  ]},
  { zone:3, badges:2, elo: 290, team:[
    m(8, 20, 'F2'),      // Wartortle (evolved at 16)
    m(12, 20, 'F1'),     // Butterfree (Metapod→Butterfree at 10)
    m(46, 20, 'F3'),     // Paras
    m(140, 20, 'B2'),    // Kabuto
    m(130, 20, 'B1'),    // Gyarados (Magikarp→Gyarados at 20 — just barely)
    m(54, 19, 'B3'),     // Psyduck
  ]},
  { zone:4, badges:3, elo: 420, team:[
    m(8, 27, 'F2'),      // Wartortle
    m(12, 27, 'F1'),     // Butterfree
    m(47, 27, 'F3'),     // Parasect (evolved at 24)
    m(141, 27, 'B2'),    // Kabutops (Kabuto→Kabutops at 40 — still Kabuto)
    m(130, 27, 'B1'),    // Gyarados
    m(55, 27, 'B3'),     // Golduck (Psyduck→Golduck at 33 — still Psyduck)
  ]},
  { zone:5, badges:4, elo: 560, team:[
    m(8, 34, 'F2'),      // Wartortle (still — evolves at 36)
    m(12, 34, 'F1'),     // Butterfree
    m(47, 34, 'F3'),     // Parasect
    m(140, 34, 'B2'),    // Kabuto (still — evolves at 40)
    m(130, 34, 'B1'),    // Gyarados
    m(55, 35, 'B3'),     // Golduck (Psyduck→Golduck at 33)
  ]},
  { zone:6, badges:5, elo: 690, team:[
    m(9, 41, 'F2'),      // Blastoise (Wartortle→Blastoise at 36)
    m(12, 41, 'F1'),     // Butterfree
    m(47, 41, 'F3'),     // Parasect
    m(141, 41, 'B2'),    // Kabutops (evolved at 40)
    m(130, 41, 'B1'),    // Gyarados
    m(55, 41, 'B3'),     // Golduck
  ]},
  { zone:7, badges:6, elo: 860, team:[
    m(9, 48, 'F2'),      // Blastoise
    m(12, 48, 'F1'),     // Butterfree
    m(47, 48, 'F3'),     // Parasect
    m(141, 48, 'B2'),    // Kabutops
    m(130, 48, 'B1'),    // Gyarados
    m(131, 47, 'B3'),    // Lapras (Z7 pool — replaced Psyduck/Golduck)
  ]},
];

// ─── Fake player 3: Mossblade (grass/psychic, higher bracket) ───────────────
// Starter Bulbasaur → Ivysaur → Venusaur. Pure progression player with iconic
// strong evolutions. Highest ELO of the three.
const mossbladeRuns = [
  { zone:1, badges:0, elo: 90, team:[
    m(1, 7, 'F2'),       // Bulbasaur
    m(69, 6, 'F1'),      // Bellsprout
    m(41, 6, 'F3'),      // Zubat
  ]},
  { zone:2, badges:1, elo: 210, team:[
    m(1, 13, 'F2'),      // Bulbasaur (Ivysaur at 16)
    m(69, 13, 'F1'),     // Bellsprout
    m(42, 13, 'F3'),     // Golbat (Zubat→Golbat at 22 — still Zubat)
    m(60, 12, 'B2'),     // Poliwag
    m(66, 13, 'B1'),     // Machop
  ]},
  { zone:3, badges:2, elo: 320, team:[
    m(2, 20, 'F2'),      // Ivysaur (Bulba→Ivy at 16)
    m(70, 20, 'F1'),     // Weepinbell (Bellsprout→Weepinbell at 21 — just hit)
    m(41, 20, 'F3'),     // Zubat
    m(60, 20, 'B2'),     // Poliwag
    m(66, 20, 'B1'),     // Machop
    m(63, 19, 'B3'),     // Abra
  ]},
  { zone:4, badges:3, elo: 480, team:[
    m(2, 27, 'F2'),      // Ivysaur
    m(70, 27, 'F1'),     // Weepinbell
    m(42, 27, 'F3'),     // Golbat (Zubat→Golbat at 22)
    m(61, 27, 'B2'),     // Poliwhirl (Poliwag→Poliwhirl at 25)
    m(67, 28, 'B1'),     // Machoke (Machop→Machoke at 28)
    m(64, 27, 'B3'),     // Kadabra (Abra→Kadabra at 16)
  ]},
  { zone:5, badges:4, elo: 620, team:[
    m(3, 34, 'F2'),      // Venusaur (Ivysaur→Venusaur at 32)
    m(71, 35, 'F1'),     // Victreebel (Weepinbell→Victreebel at 34 — just hit)
    m(42, 34, 'F3'),     // Golbat
    m(61, 34, 'B2'),     // Poliwhirl
    m(67, 34, 'B1'),     // Machoke
    m(64, 34, 'B3'),     // Kadabra
  ]},
  { zone:6, badges:5, elo: 780, team:[
    m(3, 41, 'F2'),      // Venusaur
    m(71, 41, 'F1'),     // Victreebel
    m(42, 41, 'F3'),     // Golbat
    m(61, 41, 'B2'),     // Poliwhirl
    m(68, 41, 'B1'),     // Machamp (Machoke→Machamp at 40)
    m(65, 41, 'B3'),     // Alakazam (Kadabra→Alakazam at 37)
  ]},
  { zone:7, badges:6, elo: 950, team:[
    m(3, 48, 'F2'),      // Venusaur
    m(71, 48, 'F1'),     // Victreebel
    m(42, 48, 'F3'),     // Golbat
    m(61, 48, 'B2'),     // Poliwhirl
    m(68, 48, 'B1'),     // Machamp
    m(65, 48, 'B3'),     // Alakazam
  ]},
];

const seedRuns = [
  { name: 'Crimson',   country: 'US', runs: crimsonRuns   },
  { name: 'Marina',    country: 'JP', runs: marinaRuns    },
  { name: 'Mossblade', country: 'BR', runs: mossbladeRuns },
];

let count = 0;
for (const { name, country, runs } of seedRuns) {
  for (const r of runs) {
    insert.run(
      r.zone, r.badges, 3, bucket(r.elo),
      name, JSON.stringify(r.team), now
    );
    count++;
  }
  // NOTE: previously this script also inserted/upserted a `players` row for each
  // fake so they appeared in the leaderboard with their final-zone ELO. That was
  // removed — the leaderboard is for real players only. The fakes still serve
  // matchmaking via their snapshots (which is the whole reason this script exists);
  // they just don't show up in the rankings. To remove any rows left over from a
  // previous seed run, run this once on the VPS:
  //   sudo sqlite3 .../pokemini.db \
  //     "DELETE FROM players WHERE name IN ('Crimson','Marina','Mossblade') COLLATE NOCASE"
}

console.log(`Seeded ${count} snapshots across ${seedRuns.length} fake players.`);
console.log('Players:', seedRuns.map(s => `${s.name} (ELO ${s.runs[s.runs.length-1].elo})`).join(', '));
db.close();
