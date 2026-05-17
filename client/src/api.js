// Thin server API client.
//
// Production default is /api (same-origin, served by nginx → proxied to the
// Node server). Local dev hits http://localhost:3000 directly. Override either
// by appending ?server=https://example.com to the URL.
//
// Authentication: every write call sends { player, token } where the token was
// issued by /player/claim on first name confirmation and stored in localStorage
// under `pm-claim-token`. The server rejects requests where the token doesn't
// match the player row, so a player's identity can't be impersonated even if
// someone else picks the same name on their machine.

const TOKEN_KEY = 'pm-claim-token';

function defaultServer() {
  const fromQuery = location.search.match(/server=([^&]+)/)?.[1];
  if (fromQuery) return decodeURIComponent(fromQuery);
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'http://localhost:3000';
  return '/api';
}
const SERVER = defaultServer();

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}
function setToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch {}
}
export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
}

async function post(path, body) {
  const res = await fetch(SERVER + path, {
    method: 'POST', mode: 'cors',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Surface the error body so callers can branch on { error: 'name_taken' } etc.
    let payload = null;
    try { payload = await res.json(); } catch {}
    const err = new Error('server ' + res.status);
    err.status  = res.status;
    err.payload = payload;
    throw err;
  }
  return res.json();
}

function authBody(state, extra = {}) {
  return { player: state.playerName, token: getToken(), ...extra };
}

function teamSnapshot(state) {
  return Object.entries(state.team).map(([slot, p]) => ({
    speciesId: p.speciesId, level: p.level, slot,
    hpBonus: p.hpBonus, atkBonus: p.atkBonus, spdBonus: p.spdBonus,
    type1: p.type1, type2: p.type2, abilityOverride: p.ability,
  }));
}

export const api = {
  // ─── Identity ─────────────────────────────────────────────────────────
  // Try to claim a username server-side. On success stores the returned token
  // in localStorage. On 409 it throws — the caller decides what to show.
  async claimName(name) {
    const r = await post('/player/claim', { name });
    if (r && r.token) setToken(r.token);
    return r;     // { player, token, elo }
  },

  // ─── Run lifecycle ────────────────────────────────────────────────────
  async submitRunStart(state) {
    return post('/run/start', authBody(state, { mode: state.mode, seed: state.seed }));
  },
  async endRun(state, result) {
    try {
      return await post('/run/end', authBody(state, {
        mode: state.mode, result,
        zone: state.zone, badges: state.badges,
        team: teamSnapshot(state),
      }));
    } catch (e) { /* server may not be running; ignore */ }
  },

  // ─── PvP ──────────────────────────────────────────────────────────────
  async matchPvp(state) {
    return post('/pvp/match', authBody(state, {
      zone: state.zone, badges: state.badges, strikes: state.strikes,
      team: teamSnapshot(state),
    }));
  },
  async resultPvp(state, won, round) {
    return post('/pvp/result', authBody(state, { won: !!won, round: round | 0 || 1 }));
  },
  // Forfeit a ranked run mid-flight — server applies a fixed ELO penalty (~3 losses
  // worth, see POKEMINI_FORFEIT_PENALTY) and returns the new ELO so the client can
  // update its cached display value.
  async forfeitRanked(state) {
    return post('/pvp/forfeit', authBody(state));
  },
  // Batch snapshot upload — populates the server's PvP opponent pool. Called
  // from snapshots.syncSnapshots() at title-screen time, where there's no
  // active state object — so we read player + token from localStorage. The
  // server overwrites each snapshot's player_name with the authenticated
  // name, so spoofing someone else is impossible.
  async submitSnapshots(snapshots) {
    let player = '';
    try { player = localStorage.getItem('pm-name') || ''; } catch {}
    const token = getToken();
    if (!player || !token) return { ok: false, accepted: 0, reason: 'no_auth' };
    return post('/pvp/snapshots', { player, token, snapshots });
  },
};
