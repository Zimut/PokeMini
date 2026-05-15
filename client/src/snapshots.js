// Local PvP team snapshot collection.
//
// While the game is running standalone (no VPS), every completed zone and every
// finished run drops a team snapshot into localStorage. Once the server is online,
// `syncSnapshots()` flushes the local queue to the configured `/api/snapshots/batch`
// endpoint and clears the cache. The queue persists across runs.
//
// Once enough snapshots are accumulated and the server's seeded with them, flip
// COLLECT_FROM_SINGLEPLAYER to false — at that point only ranked runs (and live
// PvP battles) feed the pool, which is the steady-state production behavior.

const STORAGE_KEY = 'pm-pvp-snapshots';
const MAX_LOCAL = 500;          // cap so a long playthrough doesn't bloat localStorage

// Toggle this to false after the VPS is live and seeded — singleplayer becomes a
// "for fun" mode again instead of a data-collection vehicle.
export const COLLECT_FROM_SINGLEPLAYER = true;

// Shape captured per snapshot — matches what the engine's runBattle() expects in a
// PvP roster, plus metadata the server will need (mode, zone reached, badges, ELO,
// timestamp). speciesId is captured AT the snapshot moment, so an auto-evolved
// team member already shows its evolved form.
function teamToRoster(team) {
  // Iterate slots and KEEP the slot key on each entry — Pokémon objects in state.team
  // don't carry their own `slot` property (the slot IS the dict key), so without
  // pulling it from the iteration we'd serialize `slot: null` and the battle engine
  // would have no way to position the unit.
  const slots = ['F1', 'F2', 'F3', 'B1', 'B2', 'B3'];
  return slots
    .filter(s => team[s] && !team[s].inDaycare)
    .map(s => {
      const p = team[s];
      return {
        speciesId: p.speciesId,
        level: p.level,
        slot: s,
        hpBonus: p.hpBonus | 0,
        atkBonus: p.atkBonus | 0,
        spdBonus: p.spdBonus | 0,
        type1: p.type1, type2: p.type2,
        abilityOverride: p.ability,
        fainted: !!p.fainted,
      };
    });
}

function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q)); } catch { /* quota / disabled */ }
}

// Append a team snapshot at the given event. `kind` is one of 'zoneClear' | 'runEnd';
// the server can weight or filter by it (zoneClear is mid-progression, runEnd is final
// roster from a successful or failed run).
export function saveSnapshot(state, kind) {
  if (!state || !state.team) return;
  // Per-mode gating: skip singleplayer captures once the flag flips.
  if (state.mode === 'singleplayer' && !COLLECT_FROM_SINGLEPLAYER) return;
  const roster = teamToRoster(state.team);
  if (roster.length === 0) return;
  const snap = {
    kind,
    mode: state.mode,
    playerName: state.playerName,
    elo: state.elo | 0,
    badges: state.badges | 0,
    zone: state.zone | 0,                    // zone the team had completed (zoneClear) or reached (runEnd)
    seed: state.seed,
    timestamp: Date.now(),
    roster,
  };
  const q = loadQueue();
  q.push(snap);
  // Keep the queue bounded — drop the oldest if we'd overflow. The server gets sent
  // as much as possible at next sync regardless.
  while (q.length > MAX_LOCAL) q.shift();
  saveQueue(q);
}

export function getSnapshots() { return loadQueue(); }
export function snapshotCount() { return loadQueue().length; }
export function clearSnapshots() { saveQueue([]); }

// Distinct, case-insensitive set of player names seen in the local snapshot queue.
// Used by the username setup screen for uniqueness validation while the game is
// still running locally; once the VPS is up the server will do an authoritative
// check, but this gives a reasonable approximation in single-machine play.
export function getKnownPlayerNames() {
  const q = loadQueue();
  const set = new Set();
  for (const s of q) {
    const n = (s.playerName || '').trim().toLowerCase();
    if (n) set.add(n);
  }
  return set;
}

// Pull a roster from the local snapshot queue suitable for the player at `state.zone`.
// Matchmaking score: zone distance is weighted much higher than ELO distance so
// progression-level matters most (a Z3 player at L21 cannot reasonably fight a Z7
// L49 team), but within the same zone we prefer opponents at similar ELO. The
// final candidate is chosen randomly from the top 5 by score so the player doesn't
// always face the same exact opponent when only a few snapshots are queued.
//   score = zoneDistance × 1000 + eloDistance
// Returns null if the queue is empty / has nothing usable; caller is expected to fall
// back to the gym-leader ghost in that case.
export function findLocalMatch(state) {
  const q = loadQueue();
  if (!q.length) return null;
  const targetZone = state.zone | 0;
  const targetElo  = state.elo  | 0;
  const ranked = q
    .map(s => ({
      s,
      score: Math.abs((s.zone | 0) - targetZone) * 1000 + Math.abs((s.elo | 0) - targetElo),
    }))
    .sort((a, b) => a.score - b.score);
  const top = ranked.slice(0, 5);
  if (!top.length) return null;
  const pick = top[Math.floor(Math.random() * top.length)].s;
  if (!pick.roster || pick.roster.length === 0) return null;

  // Legacy backfill: snapshots captured before the slot-fix had `slot: null`. Walk
  // the entries and reassign slots in canonical fill order (front first, then back).
  const SLOT_ORDER = ['F1', 'F2', 'F3', 'B1', 'B2', 'B3'];
  const roster = pick.roster.map((m, i) => ({
    ...m,
    slot: m.slot || SLOT_ORDER[i] || `F${(i % 3) + 1}`,
  }));

  return {
    opponentName: pick.playerName || 'Ghost',
    roster,
    zone: pick.zone,
    source: 'local',
  };
}

// Push the local queue to a server submit-function. The caller passes its own api.
// On a successful submit the queue is cleared. On any error we keep the queue so the
// next attempt can retry. Returns the number of snapshots submitted (0 on failure).
export async function syncSnapshots(submitFn) {
  const q = loadQueue();
  if (!q.length || typeof submitFn !== 'function') return 0;
  try {
    await submitFn(q);
    clearSnapshots();
    return q.length;
  } catch (e) {
    // Leave the queue intact so we try again next time.
    console.warn('PokeMini: snapshot sync failed, will retry later', e);
    return 0;
  }
}
