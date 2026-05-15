# PokeMini — Game Design Document

> Version 0.1 (pre-production). Source of truth for game rules. If `PRODUCTION.md` or code contradicts this document, this document wins until updated.

---

## 1. Overview

**PokeMini** is a browser-based roguelike that distills Pokémon's catch-train-battle loop into ~10 minute runs. Each run, the player drafts a team of Gen 1 Pokémon through procedural adventure stages, then battles either a cached snapshot of another real player (Ranked) or the next canon gym leader (Singleplayer Campaign).

- **Genre:** Auto-battler roguelike with async PvP.
- **Platform:** HTML5 web, desktop and mobile browsers.
- **Session length:** 8 to 12 minutes per run.
- **Modes (both in v0):**
  - **Ranked** — async PvP against snapshots of other players, ELO-tracked.
  - **Gym Leader Campaign** — singleplayer run against all 8 canon Gen 1 gym leaders in sequence. No ELO, fully offline-playable, the primary mode for testing the game.
- **USP:** A Pokémon auto-battler where each Pokémon is defined by its species ability (one per evolutionary line), and ranked play is real but never blocking — your opponent is a snapshot, not a live player.
- **Generation scope:** Gen 1 only at launch (151 species pool; subset implemented).

---

## 2. Core Run Loop

One run = up to 7 cycles of *Adventure → PvP → Town*, plus an initial starter draft.

```
[Starter Pick]
     ↓
┌─→ [Adventure Phase: 5 steps]
│       ↓
│   [PvP Phase: one async battle]
│       ↓
│   [Town Phase: shop]
│       ↓
└── Next zone (until 5 badges or 3 strikes)
```

- **Win condition:** Earn **5 badges** (PvP wins).
- **Loss condition:** Lose **3 strikes** (PvP losses). The player starts each run with 3 strikes.
- A run has at most 7 PvP rounds (2 losses + 5 wins).

---

## 3. Initial Phase — Starter Selection

The player is shown **3 starters** randomly drawn from this pool: **Bulbasaur, Charmander, Squirtle, Eevee, Pikachu, Meowth, Jigglypuff**.

- Pick one. It becomes the only Pokémon in the team.
- Starts at base level (see §6.4).
- Run is initialized: 3 strikes, 0 badges, starting money, empty item slots, current zone = Zone 1.

---

## 4. Adventure Phase

The Adventure Phase has exactly **5 steps**. At each step the player is shown **2 event cards** and picks one.

### 4.1 Event Pool & Probability

Each step rolls 2 event cards from this distribution, with constraints:

| Event | Weight |
|---|---|
| Wild Pokémon Encounter | 30% |
| Trainer Battle | 30% |
| Berry Gathering | 15% |
| Trading | 15% |
| PokéCenter | 10% |

**Constraints:**
- The two cards in a step are never the same event type.
- **Step 1** of every Adventure Phase always presents a Wild Pokémon Encounter as one of the two cards.
- **Step 5** of every Adventure Phase always presents a PokéCenter as one of the two cards.
- (The other card in steps 1 and 5 is rolled normally from the remaining pool.)

### 4.2 Events

**Wild Pokémon Encounter.** A wild Pokémon from the current zone's species pool appears at the zone's level.
- *Catch:* Add to team. If team is full (6/6), the Pokémon is auto-sold for its market value instead. Bag-style "PC" storage is intentionally absent.
- *Battle:* Resolved instantly — no team damage. Grants EXP distributed across the team.

**Trainer Battle.** Fight a themed NPC team (e.g., Bug Catcher, Hiker, Swimmer). The card always shows the trainer's **primary type** before selection. Trainer rosters are pulled from canon Gen 1 trainer archetypes for that zone.
- **Win:** money reward (500), EXP distributed across the team.
- **Loss:** no money, no EXP. Adventure continues to the next step (if there is one).
- **Healing after the battle:** surviving Pokémon are fully healed; fainted Pokémon stay fainted (they need a PokéCenter event or a Revive item to recover). **Exception** — if every Pokémon on your team was knocked out (full wipe), the entire team is fully revived so the run can continue. The wipe still has no carryover cost beyond losing the battle's XP and money.
- Trainer Battles never cost a strike — strikes are reserved entirely for PvP.

**Berry Gathering.** Choose 1 of 3 berries:
- **Oran Berry** — +HP (persistent).
- **Cheri Berry** — +ATK (persistent).
- **Salac Berry** — +SPD (persistent).

The berry goes into an item slot. Drag-and-drop onto any owned Pokémon to consume and apply the persistent stat boost.

**Trading.** The Pokémon on offer is **revealed first** — species, level, type, and ability are all visible before the player commits. The player then decides:
- *Accept:* choose one of your own Pokémon to give up. The traded-in Pokémon is gone. The new Pokémon retains its species ability (unchanged).
- *Decline:* the event ends with no change to the team.

A **Trade Card** may be used after the reveal to reroll the offered Pokémon once before deciding.

**PokéCenter.** Revives all fainted Pokémon and restores them to full HP for the upcoming PvP battle.

---

## 5. Battle Phase

PokeMini ships v0 with two modes. Both modes use the same core loop (§2) — they only differ in what fills the Battle Phase.

### 5.1 Ranked Mode (Async PvP)

After Adventure, the player is matched against a **snapshot** of another player's team that previously stood at the same `(zone, badges, strikes)` slot. The matchup is fully deterministic from the two team states and a shared seed.

- **Win:** +1 badge. ELO delta based on the round (see §10).
- **Loss:** −1 strike. ELO delta based on the round. Team is healed before Town anyway.

If no opponent snapshot exists for the slot (cold start, off-hours), the server falls back to a **canon Gen 1 gym leader team** scaled to the zone's level (decision #6) — the same teams that drive Singleplayer (§5.2). Zone-to-leader mapping for Ranked fallback:

| Zone | Fallback gym leader |
|---|---|
| 1 | Brock |
| 2 | Misty |
| 3 | Lt. Surge |
| 4 | Erika |
| 5 | Koga |
| 6 | Sabrina |
| 7 | Blaine |

Giovanni does not appear as a Ranked fallback — he is the Singleplayer final boss only.

### 5.2 Gym Leader Campaign (Singleplayer)

Sequential single-player run against canon Gen 1 gym leaders, one per zone. **Identical progression to Ranked Mode**: same 7 zones, same 5-badges-to-win, same 3-strikes-to-lose, same max-7-rounds run length. The only difference vs. Ranked is who fills the Battle Phase — a scripted gym leader instead of an async opponent snapshot.

| Stage / Zone | Gym Leader | Region | Type focus | Zone level |
|---|---|---|---|---|
| 1 | Brock | Pewter / Mt. Moon | Rock | 7 |
| 2 | Misty | Cerulean | Water | 14 |
| 3 | Lt. Surge | Vermilion | Electric | 21 |
| 4 | Erika | Celadon | Grass | 28 |
| 5 | Koga | Fuchsia | Poison | 35 |
| 6 | Sabrina | Saffron | Psychic | 42 |
| 7 | Blaine | Cinnabar | Fire | 49 |

These are the same 7 leader teams used as the Ranked cold-start fallback (§5.1) — one authored roster serves both modes.

**Run rules** (identical to Ranked):
- **Win the gym leader battle:** +1 badge.
- **Lose the gym leader battle:** −1 strike. Team is healed before the next Town.
- **5 badges = run won.** **3 strikes = run lost.** Max 7 rounds.
- **No ELO change**, win or lose. Singleplayer never touches the ranked ladder.
- Money, items, and Pokémon economy are identical to Ranked.

Giovanni and the Elite Four are reserved for post-v0 content (see §12).

Singleplayer is the primary mode for early testing because it does not require the matchmaking backend.

---

## 6. Pokémon

### 6.1 Stats

All Pokémon use only **three stats**, derived once at species level from Gen 1 base stats:

- **HP** = max(base HP, base DEF, base SP.DEF).
- **ATK** = max(base ATK, base SP.ATK).
- **SPD** = base SPEED.

Stats are scaled linearly with the Pokémon's current level. Berries, TMs, HMs, and Evosodas modify the species' baseline for that specific Pokémon instance.

### 6.2 Types

Pulled from official Gen 1 typing. The standard type-effectiveness chart applies (Gen 1 version — note ghost/psychic interaction is canonically broken in Gen 1; we use the corrected Gen 2+ chart for fairness, flagged in Open Questions).

### 6.3 Abilities

- Each **evolutionary line** has one signature ability.
- All stages within a line share that ability, scaled stronger at higher evolution stages.
- Abilities are passive and triggered by specific battle events: `OnBattleStart`, `OnTurnStart`, `OnTurnEnd`, `OnAttack`, `OnHit`, `OnKO`, `OnFaint`, `OnAllyFaint`.
- See `ABILITIES.md` for the full list.

### 6.4 Levels & Evolution

- Starter Pokémon begin at **Level 5**.
- Each zone has a "zone level" that defines the level of wild encounters, traded Pokémon, and trainer teams. Curve is **+7 per zone**:

  | Zone | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |---|---|---|---|---|---|---|---|
  | Level | 7 | 14 | 21 | 28 | 35 | 42 | 49 |

  Dragonair's evolution to Dragonite was lowered from 55 → 47 so the Dratini line can complete within Zone 7 at the new spacing.

- EXP is shared across the team. A "battled and instantly defeated" wild encounter grants roughly one level's worth of EXP at the current zone tier.
- **Evolution is always level-based** (decision #2). A Pokémon evolves when it reaches its canonical evolution level, or when an **Evosoda** pushes it past that threshold. Trade evolutions (Kadabra→Alakazam, Machoke→Machamp, Haunter→Gengar, Graveler→Golem) and stone evolutions (Eevee, Vulpix, Growlithe, Pikachu, Gloom, Weepinbell, Exeggcute, Staryu, Shellder, Poliwhirl, Nidorino, Nidorina, Clefairy, Jigglypuff) are mapped to specific levels in `client/src/data/evolutions.json` — see `PRODUCTION.md`. Eevee always evolves into **Vaporeon** (decision #1).

### 6.5 Species Pool by Zone

The 7 zones align 1:1 with the canon Gen 1 gym leaders (see §5). Each zone has a thematic type focus and a level tier, and pulls from a curated pool of Gen 1 evolutionary lines. Pokémon caught in a zone arrive at that zone's level; those that evolve do so via canonical level thresholds (decision #2) or via Evosoda.

Wild pools are sized at **9 species per zone** (Zone 7 sits at 8). Starter-pool Pokémon
(Pikachu, Meowth, Jigglypuff, NidoranF, Eevee) are intentionally excluded from wild encounters —
the player gets them at run start, so they don't need to find them again in the wild.

**Zone 1 — Pewter / Mt. Moon / Route 22 (Brock, Rock, L7)** — 9
*Early-game pool, broad type variety, low-power lines.*
- Pidgey → Pidgeotto → Pidgeot
- Rattata → Raticate
- Caterpie → Metapod → Butterfree
- Weedle → Kakuna → Beedrill
- Geodude → Graveler → Golem
- Zubat → Golbat
- Paras → Parasect
- Bellsprout → Weepinbell → Victreebel (early-zone variety)
- Kabuto → Kabutops (Mt. Moon fossil canon)

**Zone 2 — Cerulean / Route 4 / Rock Tunnel (Misty, Water, L14)** — 9
*Water-leaning route + rocky transitions — non-water encounters cover Rock Tunnel and Route 4 ground.*
- Magikarp → Gyarados
- Psyduck → Golduck
- Poliwag → Poliwhirl → Poliwrath
- Goldeen → Seaking
- Ekans → Arbok
- Onix (Rock Tunnel)
- Machop → Machoke → Machamp (Rock Tunnel)
- Sandshrew → Sandslash (Route 4)
- Spearow → Fearow (Route 4)

**Zone 3 — Vermilion / Diglett's Cave / Power Plant (Lt. Surge, Electric, L21)** — 9
*Electric core plus ground/water/psychic transitions.*
- Voltorb → Electrode
- Diglett → Dugtrio
- Doduo → Dodrio
- Drowzee → Hypno
- Rhyhorn (Power Plant rocky)
- Vulpix → Ninetales (early fire intro)
- Horsea → Seadra (Cerulean coastal carryover)
- Seel → Dewgong (coastal water)
- Abra → Kadabra → Alakazam (Saffron carryover, rare)

**Zone 4 — Celadon / Lavender / Pokémon Tower (Erika, Grass, L28)** — 9
*Grass / ghost core plus urban encounters (Celadon) and Pokémon Tower fillers.*
- Tangela
- Exeggcute → Exeggutor
- Gastly → Haunter → Gengar
- Oddish → Gloom → Vileplume
- Cubone → Marowak (Pokémon Tower)
- Porygon (Celadon Game Corner)
- Growlithe → Arcanine (Route 7/8 canon, mid-game fire)
- Tentacool → Tentacruel (coastal water)
- Mankey → Primeape (Route 9 fighting)

**Zone 5 — Fuchsia / Safari Zone (Koga, Poison, L35)** — 9
*Poison core plus Safari Zone exotics.*
- Grimer → Muk
- Koffing → Weezing
- Nidoran♂ → Nidorino → Nidoking
- Tauros
- Kangaskhan
- Pinsir
- Scyther
- Clefairy → Clefable (Safari rare)
- Dratini → Dragonair → Dragonite (Safari Game Corner)

**Zone 6 — Saffron / Saffron Dojo (Sabrina, Psychic, L42)** — 9
*Psychic core plus Saffron Dojo fighting lineage and urban endgame.*
- Mr. Mime
- Hitmonlee
- Hitmonchan
- Jynx
- Slowpoke → Slowbro
- Lickitung
- Chansey
- Snorlax (Route 12/16 — sleeping in the road)
- Magnemite → Magneton (Silph Co. industrial)

**Zone 7 — Cinnabar / Pokémon Mansion / Seafoam (Blaine, Fire, L49)** — 8
*Fire core plus fossil revivals, Seafoam coast water, and endgame elites.*
- Magmar
- Ditto
- Omanyte → Omastar
- Aerodactyl (rare)
- Lapras
- Krabby → Kingler (Seafoam Islands)
- Shellder → Cloyster (Seafoam Islands)
- Electabuzz (Pokémon Mansion electrical)

Trainer archetypes per zone are listed in `PRODUCTION.md` §4.

---

## 7. Battle System

### 7.1 Team Layout

```
Back row    [B1] [B2] [B3]
Front row   [F1] [F2] [F3]
             ↑    ↑    ↑
           Col1 Col2 Col3
```

Six slots total: 3 front, 3 back. **Terminology:**
- **Row** = horizontal line. The **front row** is F1/F2/F3; the **back row** is B1/B2/B3.
- **Column** = vertical pair. Column 1 is F1+B1, Column 2 is F2+B2, Column 3 is F3+B3.

Players freely drag Pokémon between any of the 6 slots between battles (and during Town).

### 7.2 Turn Order

At the start of each turn, all *alive* Pokémon are sorted by current SPD (descending, ties broken randomly with a deterministic seed). They act once each in that order.

### 7.3 Targeting

A Pokémon targets:
1. The **front-row enemy in its own column**, if alive.
2. Otherwise, the **nearest alive front-row enemy** (closest column).
3. Once the entire enemy front row is fainted, repeat steps 1–2 against the back row.

### 7.4 Damage

Per attack: `damage = ATK_attacker * type_mult * crit_mult - small_def_floor`. Damage formula kept intentionally simple. Crit rate = 5% baseline, 2× damage. Type multipliers follow the standard chart. Status (poison, burn, paralysis, sleep) is applied only by abilities — there are no individual moves.

### 7.5 Turn End

After all alive Pokémon have acted, `OnTurnEnd` abilities fire (in SPD order). Then a new turn begins, recalculating order.

### 7.6 Battle End

Battle ends when one team has zero alive Pokémon. The other team wins.

---

## 8. Town Phase, Money & Items

After a PvP battle, the team is **fully healed**. The player enters the Town, which presents:

- **3 buyable items**, randomly drawn (no duplicates within a town).
- A **sell** option for any team Pokémon.

### 8.1 Economy (decision #7 — starting values, subject to playtest)

| Source / Sink | Value |
|---|---|
| Starting money | **1000** |
| Trainer Battle win | **+500** |
| PvP win | **0** — the badge and ELO are the reward. PvP intentionally pays no money so adventure choices and trainer fights drive the economy. |
| Sell a Pokémon | **300 × evolution stage** (stage 1 = 300, stage 2 = 600, stage 3 = 900) |
| Sell a full-team wild capture | same formula |
| Sell a berry (in Town) | **+500** per berry |

### 8.2 Item pool

| Item | Effect | Cost |
|---|---|---|
| **Trade Card** | When used during a Trading event, reroll the offered Pokémon once. | 250 |
| **Revive** | Revives a fainted Pokémon. | 300 |
| **X-Vitamin** | Apply to a Pokémon — it enters the **next battle** with **+50% HP, +50% ATK, and +50% SPD**. Single-use, single-battle. | 300 |
| **Great Ball** | Drag onto a Wild Pokémon Encounter card; the wild Pokémon is captured at **+3 levels**. | 400 |
| **Evosoda** | Adds **3 levels** to target Pokémon (may trigger evolution). | 600 |
| **TM** | Operates on the **secondary type only** (decision #8): mono-types get a random second type added; dual-types have their second type rerolled to a different random type. The primary type is never touched. | 600 |
| **HM** | Rerolls the Pokémon's ability into another from the **same evolutionary tier** (decision #9). | 600 |
| **Lure** | Drag onto a Wild Pokémon Encounter card; the wild Pokémon is replaced with one from the **next zone's pool**, at the next zone's level. Stronger reward, harder fight or capture. | 600 |

Items live in 3 item slots. When all 3 slots are full, additional items cannot be obtained (Berry Gathering and Town purchases are disabled; Wild captures that would overflow default to "sell").

---

## 9. UI & HUD

The screen is always laid out so the player can see:

- **Team layout** (6 slots, front/back rows visually distinct). Drag-and-drop reorder anywhere outside of a battle.
- **Item slots** (3 horizontally arranged). Drag items onto valid targets to use.
- **Top bar:** player name, current rank icon (see §10), badge count (out of 5), strike count (out of 3), money.
- **Phase header:** zone name, current step (Adventure), or "Town" / "PvP".

### 9.1 Tooltip rules

- Stats are shown beneath each Pokémon's portrait.
- Ability **name** is shown beneath stats; **full description** appears in a tooltip on hover (desktop) or tap-and-hold (mobile).
- Items show name only; tooltip on hover/tap reveals description and cost.
- Type icons show on the portrait; tooltip on hover/tap shows current type matchups.

### 9.2 Style Constraints (carry to all art and copy)

- **No emojis anywhere.**
- **No tutorial text anywhere.** Only **titles** (zone name, phase name, item name, ability name).
- Visual identity: clean **Nintendo Wii–inspired** palette — soft whites, muted blues, gentle pastels, generous whitespace, simple sans-serif typography (think *Mii Channel* / *Wii Shop*).
- Sprites are pulled from public Pokémon sprite repositories at runtime (see Tech Stack).

---

## 10. Ranking System

**Applies to Ranked Mode only.** Singleplayer never changes ELO. ELO-based, persistent across runs.

- **Tiers:** Poké Ball → Great Ball → Ultra Ball → Master Ball.
- Each tier has 4 sub-ranks (1 = lowest, 4 = highest within tier).
- 16 ranks total. New players start at **Poké Ball 1**.

**ELO change per PvP battle, based on the round (1–7) at which the player's run ended:**

| Round reached when run ended | ELO delta on win | ELO delta on loss |
|---|---|---|
| Round 1 or 2 (lost) | — | **−ELO** |
| Round 3 (lost) | — | **0** |
| Round 4 (lost) | — | **0** |
| Round 5 (lost) | — | **+1** |
| Round 6 (lost) | — | **+2** |
| Round 7 (lost) | — | **+3** |
| Full clear (5 badges, won run) | **+5** | — |

The exact ELO point magnitudes and tier thresholds are tunable. See `OPEN_QUESTIONS.md`. Per-match ELO change should also factor opponent rank; default is symmetric.

---

## 11. Design Decisions Locked

All initial open questions have been answered (see `OPEN_QUESTIONS.md` for the full log). The mechanics affected are now documented in their respective sections of this GDD. The remaining open work is balance tuning after the first playable build (item costs, EXP per encounter, exact ELO magnitudes).

---

## 12. Planned for Future (post-v0)

- Generations 2+.
- Accounts beyond a player name (a single anonymous identifier is fine for v0).
- **Giovanni and the Elite Four** as additional Singleplayer content (extended campaign mode or post-victory bonus stages).

## 13. Permanently Out

Not "deferred" — explicitly rejected. The build agent should not propose these.

- Held items.
- Move selection. Pokémon attack with a single generic species attack; abilities are the entire mechanical identity.
- Real-time PvP. PvP is asynchronous by design.
- Cosmetics and monetization.
- Replays.
