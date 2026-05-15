// Persistent Pokédex — tracks species the player has SEEN (had on the team at some
// point) and WON WITH (had on the team when a successful ranked run completed).
//
// Stored in localStorage separately from `pm-run` so the dex outlives any individual
// run — surviving abandons, losses, and even clearRun() at run end.

import { SPECIES } from './data.js';

const KEY_SEEN = 'pm-dex-seen';
const KEY_WON  = 'pm-dex-won';

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch { /* quota or disabled */ }
}

let seenSet = loadSet(KEY_SEEN);
let wonSet  = loadSet(KEY_WON);

export function getSeenSet() { return seenSet; }
export function getWonSet()  { return wonSet; }

// Mark a single species as seen. Idempotent — re-calling for an already-seen species
// is a no-op (no save, no allocation).
export function markSeen(speciesId) {
  if (!SPECIES[speciesId]) return;
  if (seenSet.has(speciesId)) return;
  seenSet.add(speciesId);
  saveSet(KEY_SEEN, seenSet);
}

// Mark every team member as seen — convenience wrapper called from repaint().
export function markTeamAsSeen(state) {
  if (!state || !state.team) return;
  for (const slot of ['F1','F2','F3','B1','B2','B3']) {
    const p = state.team[slot];
    if (p && SPECIES[p.speciesId]) markSeen(p.speciesId);
  }
}

// All species in the same evolutionary line, from base form up to AND including the
// supplied id. Walks evolvesTo links forward from the discovered base. Used when
// awarding "won with" — winning with Charizard also credits Charmander + Charmeleon.
export function priorEvolutions(speciesId) {
  if (!SPECIES[speciesId]) return [];
  const all = Object.values(SPECIES);
  let baseId = speciesId;
  // Walk backwards (no parent pointers — scan by evolvesTo match) to find the base form.
  while (true) {
    const prev = all.find(s => s.evolvesTo === baseId);
    if (!prev) break;
    baseId = prev.id;
  }
  const line = [];
  let cur = SPECIES[baseId];
  while (cur) {
    line.push(cur.id);
    if (cur.id === speciesId) break;
    if (!cur.evolvesTo) break;
    cur = SPECIES[cur.evolvesTo];
  }
  return line;
}

// Awarded on successful ranked run completion. Marks the species AND its prior
// evolutions as won. Also implies seen (so the row turns black + gets the medal in one
// go even if somehow the seen flag was missed earlier).
export function markRankedWin(speciesId) {
  if (!SPECIES[speciesId]) return;
  let touched = false;
  for (const id of priorEvolutions(speciesId)) {
    if (!wonSet.has(id)) { wonSet.add(id); touched = true; }
    if (!seenSet.has(id)) { seenSet.add(id); markSeen(id); }   // markSeen handles its own save
  }
  if (touched) saveSet(KEY_WON, wonSet);
}
