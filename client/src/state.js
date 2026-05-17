// Run state management and helpers.
import { SPECIES, ZONES, RUN, TYPES, ITEMS, BERRIES } from './data.js';
import { actualStats } from './engine.js';

export function newRun({ mode = 'singleplayer', playerName = 'Player', elo = 0, seed = Date.now() } = {}) {
  return {
    mode, playerName, elo, seed,
    formatVersion: RUN.saveFormatVersion,
    zone: 1,
    badges: 0,
    strikes: RUN.startingStrikes,
    money: RUN.startingMoney,
    team: {},                // slot → instance
    items: [null, null, null],
    daycare: null,            // Pokémon currently in daycare — returns at next adventure start
    log: [],
    runOver: false,
    result: null,            // 'won' | 'lost' | null
    // ─── Resume bookkeeping ──────────────────────────────────────────────
    // `phase` is the screen the player should land on after a page refresh.
    // `advStep` is the current adventure step (was a module-level in phases.js).
    // `pendingStep` caches the data rolled for the current advStep (the two wild
    // candidates / two trainers / two special-event picks) so a refresh during
    // a choice doesn't re-roll the cards. Shape differs by step kind — the
    // step renderer owns the schema and is responsible for ignoring stale shapes.
    phase: 'starterPick',
    advStep: 0,
    pendingStep: null,
    seenTrainers: [],          // trainer names already rolled this zone; reset on zone change
  };
}

// ─── Run persistence ────────────────────────────────────────────────────
// Single-slot save to localStorage. Cleared on run end or via the options menu.
const STORAGE_KEY = 'pm-run';

export function saveRun(state) {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // Quota exceeded / disabled storage — silent failure, the run continues in memory.
    console.warn('PokeMini: saveRun failed', e);
  }
}

export function loadRun() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    // Sanity check — discard obviously malformed saves rather than crashing the app.
    if (!s || typeof s !== 'object' || !s.mode || !s.team) return null;
    // Save-format gate: legacy runs from before the adventure rework (or any future
    // bump) get wiped on load. The old `pendingEvents` quad shape and the 5-step
    // advStep range would crash or misrender against the new step-kind dispatch.
    if ((s.formatVersion | 0) < (RUN.saveFormatVersion | 0)) {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      return null;
    }
    // Migration: clear any item slots that reference items no longer in the registry
    // (e.g. retired Repel / Revive). Keeps an old in-flight save from hauling around
    // a slot it can't actually use.
    if (Array.isArray(s.items)) {
      for (let i = 0; i < s.items.length; i++) {
        const it = s.items[i];
        if (it && !ITEMS[it.id] && !BERRIES[it.id]) s.items[i] = null;
      }
    }
    return s;
  } catch (e) {
    return null;
  }
}

export function clearRun() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

export function hasSavedRun() {
  const s = loadRun();
  return s && !s.runOver;
}

// Build a Pokémon instance from species at a given level.
export function makeInstance(speciesId, level) {
  const sp = SPECIES[speciesId];
  if (!sp) throw new Error('unknown species ' + speciesId);
  let curId = speciesId;
  let curSp = sp;
  // Auto-evolve if level exceeds species evolution threshold
  while (curSp.evolvesTo && curSp.evolvesAt && level >= curSp.evolvesAt) {
    curId = curSp.evolvesTo;
    curSp = SPECIES[curId];
    if (!curSp) break;
  }
  const stats = actualStats(curSp, level);
  return {
    speciesId: curId,
    level,
    hp: stats.hp, hpMax: stats.hp, atk: stats.atk, spd: stats.spd,
    type1: curSp.type1, type2: curSp.type2,
    ability: curSp.ability,
    hpBonus: 0, atkBonus: 0, spdBonus: 0,
    fainted: false,
    xVitamin: false,         // single-battle buff
  };
}

export function teamArray(state) {
  return Object.values(state.team);
}
export function teamCount(state) {
  return Object.keys(state.team).length;
}
export function firstEmptySlot(state) {
  for (const s of ['F1','F2','F3','B1','B2','B3']) if (!state.team[s]) return s;
  return null;
}

// Slot of the Pokémon currently away at daycare, or null. Daycare members stay in their
// team slot (so the slot can't be reused) but are tagged inDaycare:true — they're filtered
// out of battle, can't be released/sold/given items, and render greyed-out in the UI.
export function daycareSlot(state) {
  for (const s of ['F1','F2','F3','B1','B2','B3']) if (state.team[s]?.inDaycare) return s;
  return null;
}

export function healAll(state) {
  for (const p of teamArray(state)) { p.hp = p.hpMax; p.fainted = false; }
}

// Heal damage but leave fainted Pokémon fainted.
export function healSurvivors(state) {
  for (const p of teamArray(state)) {
    if (!p.fainted) p.hp = p.hpMax;
  }
}

// Add EXP / level up team
export function grantTeamExp(state, levelsEach = 1) {
  for (const p of teamArray(state)) {
    p.level = Math.min(100, p.level + levelsEach);
    checkEvolve(p);
    // Re-derive stats from new level
    const sp = SPECIES[p.speciesId];
    const stats = actualStats(sp, p.level);
    const hpRatio = p.hp / p.hpMax;
    p.hpMax = stats.hp + p.hpBonus;
    p.atk = stats.atk + p.atkBonus;
    p.spd = stats.spd + p.spdBonus;
    p.hp = Math.floor(p.hpMax * hpRatio);
  }
}

export function checkEvolve(p) {
  let sp = SPECIES[p.speciesId];
  while (sp && sp.evolvesTo && sp.evolvesAt && p.level >= sp.evolvesAt) {
    p.speciesId = sp.evolvesTo;
    sp = SPECIES[p.speciesId];
    if (!sp) break;
    p.type1 = sp.type1;
    // TM-rerolled secondary type carries across evolution.
    if (!p.type2Locked) p.type2 = sp.type2;
    // HM-rerolled ability carries across evolution. The engine reads ability-stage
    // values via `species.stage`, which DOES advance with evolution — so a locked
    // ability automatically scales up if the ability has a next stage, and stays at
    // the same effective value if it doesn't.
    if (!p.abilityLocked) p.ability = sp.ability;
  }
}

export function sellValue(p) {
  const sp = SPECIES[p.speciesId];
  return 200 * (sp.stage || 1);
}

// Type chart helpers
const ALL_TYPES = TYPES;
export function rerollType(p) {
  // Mono → add random second; dual → reroll second.
  // Once a TM has rerolled the secondary type, set `type2Locked` so evolutions don't
  // overwrite the player's choice with the next-stage species' canonical type2.
  const sp = SPECIES[p.speciesId];
  const exclude = new Set([sp.type1]);
  if (p.type2) exclude.add(p.type2);
  const choices = ALL_TYPES.filter(t => !exclude.has(t));
  p.type2 = choices[Math.floor(Math.random() * choices.length)];
  p.type2Locked = true;
}

// Item slot helpers
export function hasItemSlot(state) { return state.items.some(s => s === null); }
export function addItem(state, itemId) {
  for (let i = 0; i < state.items.length; i++) if (!state.items[i]) { state.items[i] = { id: itemId }; return true; }
  return false;
}
export function removeItem(state, idx) { state.items[idx] = null; }
export function findItem(state, itemId) {
  for (let i = 0; i < state.items.length; i++) if (state.items[i]?.id === itemId) return i;
  return -1;
}

// Roll zone wild encounter.
//
// Level formula (replaces the old random (min+1)..(max-1) roll): deterministic
//   level = zone.min + state.advStep + EARLY_ZONE_BONUS[state.zone]
// so wilds scale predictably step-by-step within a zone. Early zones get an extra
// bump (Z1 +2, Z2 +1) because their `min` is low and the gym jumps several levels
// from there — without the bonus, step-0 Z1 wilds would only be Level 2.
//
// Pool selection by option:
//   • default            → current zone's pool
//   • opts.tradeMix      → current zone + next zone pools combined (Trading event)
//   • opts.lure          → all zones combined (Lure item — any Pokémon, current zone level)
//
// `opts.level` still overrides everything (used by Trade events for their own +2+advStep curve).
const WILD_ZONE_BONUS = { 1: 2, 2: 1 };
export function rollWild(state, rng, opts = {}) {
  const z = ZONES[state.zone - 1];
  let pool = z.pool;
  if (opts.tradeMix && state.zone < 7) {
    const nz = ZONES[state.zone];
    pool = [...z.pool, ...nz.pool];
  } else if (opts.lure) {
    pool = ZONES.flatMap(zone => zone.pool);
  }
  const r = () => (rng?.float?.() ?? Math.random());
  const id = pool[Math.floor(r() * pool.length)];
  const bonus = WILD_ZONE_BONUS[state.zone] || 0;
  const baseLevel = z.min + (state.advStep || 0) + bonus;
  const level = (opts.level != null) ? opts.level : baseLevel;
  return makeInstance(id, level);
}
