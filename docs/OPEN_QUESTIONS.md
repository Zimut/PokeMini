# PokeMini — Design Decisions Log

All initial open questions are now answered. The relevant rules have been moved into the GDD; this file is a record of *why* each decision was made.

| # | Question | Decision |
|---|---|---|
| 1 | Eevee evolution path | **Always Vaporeon.** Eevee evolves into Vaporeon and only Vaporeon. |
| 2 | Trade-evolution & stone-evolution Pokémon | **Level-based for all.** Kadabra, Machoke, Haunter, Graveler, and every stone evolution (Eevee, Vulpix, Growlithe, Pikachu, Gloom, Weepinbell, Exeggcute, Staryu, Shellder, Poliwhirl, Nidorino, Nidorina, Clefairy, Jigglypuff) evolve at fixed levels. Specific levels live in `client/src/data/evolutions.json`. |
| 3 | Level scaling per zone | **+8 levels per zone.** Zones run L8 / 16 / 24 / 32 / 40 / 48 / 56. Starter begins at L5. |
| 4 | Type chart version | **Gen 2+ corrected chart.** No Ghost/Psychic bug. |
| 5 | Strikes from Trainer Battles | **Only on full team wipe.** If all 6 Pokémon faint in a Trainer Battle, the player loses 1 strike, gets no prizes or EXP, the team is fully healed, and the remaining Adventure steps are skipped — the run jumps to the PvP Phase. Otherwise (any Pokémon survives, or the player wins), Trainer Battles never cost strikes. |
| 6 | PvP cold-start fallback | **Canon gym leader teams.** When no recent snapshot exists for `(zone, badges, strikes, elo_bucket)`, the server matches the player against a canon Gen 1 gym leader team scaled to the zone's level (Brock, Misty, Surge, Erika, Koga, Sabrina, Blaine — mapped to zones 1–7). Giovanni is reserved for a future singleplayer mode that battles all 8 gym leaders in sequence. |
| 7 | Money & costs | **Start at 1000.** Trainer win = 500. PvP win = 400 + 100 per existing badge. Sell Pokémon = 300 × evolution stage. Items: Repel 250 / Trade Card 250 / Revive 300 / Great Ball 400 / Evosoda 600 / TM 750 / HM 750. All numbers are first-pass and will be tuned during playtest. |
| 8 | TM on dual-type Pokémon | **TM only ever affects the secondary type.** Mono-type Pokémon get a random second type added. Dual-type Pokémon have their second type rerolled to a different random type. The primary type is never modified. |
| 9 | HM ability reroll pool | **Same evolutionary tier only.** An HM on a stage-1 Pokémon draws from stage-1 abilities; stage-2 from stage-2; stage-3 from stage-3. |
| 10 | Joke abilities for low-power Pokémon | **Caterpie line: balanced** (Shed Skin as authored). **Magikarp line: joke ability via tuning.** Magikarp shares Gyarados' ability (Intimidate) but at the lowest possible value — Magikarp lowers enemy ATK by 5%, Gyarados by 25%. Same ability, dramatic power gap reinforces the canon "useless until it evolves" feel without making Magikarp do literally nothing. |
| 11 | Item cost vs. money curve | **Deferred to playtest** — covered by decision #7's starting values; full balance pass after the first playable build. |

## Items still to revisit after first playable

- ELO magnitudes per round (the table in GDD §10 is a starting point; needs live data).
- EXP per Wild Encounter battled and per Trainer Battle won.
- Berry stacking diminishing returns curve (currently 100% / 60% / 30% / capped).
- Snapshot freshness window (currently 24h tombstone).
- Whether Eevee should also appear in any wild pool, or stay starter-only.
- Whether Pikachu should appear wild in Zone 2.

These will be answered with data once M5 is up and a few runs have been played.
