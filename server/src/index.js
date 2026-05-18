// PokeMini server — Fastify + SQLite.
//
// Security model:
//   • Every request lives behind nginx on the VPS; we trust X-Forwarded-* headers
//     so rate-limit and logs see the real client IP.
//   • CORS is locked to the production domain(s) plus localhost during dev.
//   • All write endpoints validate the body via Fastify JSON Schemas — anything
//     that doesn't fit gets a 400 with no further work done.
//   • Authenticated routes require { player, token } in the body. The token is
//     minted by /player/claim and stored client-side in localStorage. Without
//     the right token you can't act as that player.
//   • ELO is server-authoritative — /pvp/result reads the player's row, applies
//     the delta, and writes back. The client value is ignored for the math.
//   • Per-route rate limits cap the abusable endpoints.

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { claimPlayerName, verifyPlayer, queries } from './db.js';
import { findOpponent, writeSnapshot, pruneOld } from './matchmaking.js';
import { eloDelta, eloBucket } from './elo.js';

// Logger: pretty-printed in dev (when pino-pretty is installed as a devDep),
// raw JSON in production. Plain JSON streams cleanly to journalctl, which is
// where the systemd service writes anyway — pretty-printing is dead weight.
const isProd = process.env.NODE_ENV === 'production';
const fastify = Fastify({
  // trustProxy: nginx terminates TLS and forwards real IPs via X-Forwarded-For.
  // Without this, rate-limit and logs key on the proxy's loopback address and
  // every request looks like it came from 127.0.0.1.
  trustProxy: true,
  logger: isProd ? true : { transport: { target: 'pino-pretty' } },
  // Defense-in-depth: nginx caps client_max_body_size at 16k, but Fastify gets
  // its own limit so a misconfigured proxy can't sneak megabytes through.
  bodyLimit: 32 * 1024,
});

// ─── CORS ─────────────────────────────────────────────────────────────────
// Origin list is environment-overridable via POKEMINI_CORS_ORIGINS (comma-
// separated). Default covers labzts.fun + localhost dev.
const corsOrigins = (process.env.POKEMINI_CORS_ORIGINS || 'https://labzts.fun,https://pokemini.labzts.fun,http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080')
  .split(',').map(s => s.trim()).filter(Boolean);
await fastify.register(cors, {
  origin: (origin, cb) => {
    // No Origin header → same-origin or curl/server-to-server, allow.
    if (!origin) return cb(null, true);
    if (corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origin not allowed'), false);
  },
});

// ─── Rate limit ───────────────────────────────────────────────────────────
// Global cap. Hot routes register their own stricter `config.rateLimit` blocks
// below to tighten further. Keyed off the real client IP (trustProxy in effect).
await fastify.register(rateLimit, {
  global: true,
  max: 120,
  timeWindow: '1 minute',
  // Returns clean JSON, not the default text response.
  errorResponseBuilder: (req, ctx) => ({
    error: 'rate_limited',
    retryAfterSec: Math.ceil(ctx.ttl / 1000),
  }),
});

// ─── JSON Schemas (reused across routes) ─────────────────────────────────
const playerNamePattern = '^[A-Za-z0-9_]{3,16}$';

const teamMemberSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['speciesId', 'level'],
  properties: {
    speciesId:       { type: 'integer', minimum: 1, maximum: 151 },
    level:           { type: 'integer', minimum: 1, maximum: 60 },
    slot:            { type: ['string', 'null'], enum: ['F1','F2','F3','B1','B2','B3', null] },
    hpBonus:         { type: ['integer', 'null'], minimum: 0, maximum: 999 },
    atkBonus:        { type: ['integer', 'null'], minimum: 0, maximum: 999 },
    spdBonus:        { type: ['integer', 'null'], minimum: 0, maximum: 999 },
    type1:           { type: ['string', 'null'], maxLength: 16 },
    type2:           { type: ['string', 'null'], maxLength: 16 },
    abilityOverride: { type: ['string', 'null'], maxLength: 32 },
    fainted:         { type: ['boolean', 'null'] },
    shiny:           { type: ['boolean', 'null'] },
  },
};

const teamSchema = { type: 'array', minItems: 1, maxItems: 6, items: teamMemberSchema };

// Body fragment shared by every authenticated endpoint.
const authProps = {
  player: { type: 'string', pattern: playerNamePattern },
  token:  { type: 'string', minLength: 8, maxLength: 64 },
};

// ─── Auth hook ────────────────────────────────────────────────────────────
// Any route with config.requiresAuth runs this. Validates { player, token }
// and stashes the player row on req.player for the handler to use.
fastify.addHook('preHandler', async (req, rep) => {
  if (!req.routeOptions.config?.requiresAuth) return;
  const { player, token } = req.body || {};
  const row = verifyPlayer(player, token);
  if (!row) return rep.code(401).send({ error: 'auth_failed' });
  req.authPlayer = row;
});

// ─── Geo-IP lookup ───────────────────────────────────────────────────────
// Resolves a 2-letter ISO country code from an IP using ipapi.co's free tier
// (1k/day, no API key). Best-effort: short timeout, swallows errors, returns
// null on any failure — the caller decides whether to retry. Skipped for local
// / private / loopback IPs so dev environments don't waste lookups.
async function lookupCountry(ip) {
  if (!ip) return null;
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch(`https://ipapi.co/${ip}/country/`, {
        headers: { 'User-Agent': 'PokeMini/1.0 (pokemini.labzts.fun)' },
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      const text = (await res.text()).trim();
      // ipapi.co returns just the country code on success ("BR"), or a JSON
      // error body on failure. Validate as a 2-letter A-Z to filter out the
      // error case without needing to inspect the body.
      if (/^[A-Z]{2}$/.test(text)) return text;
      return null;
    } finally { clearTimeout(timer); }
  } catch { return null; }
}

// ─── /health ──────────────────────────────────────────────────────────────
fastify.get('/health', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
  async () => ({ ok: true, ts: Date.now() }));

// ─── /leaderboard ────────────────────────────────────────────────────────
// Public, no auth. Returns the top N players by ELO. Caller is the in-game
// leaderboard widget; rate-limited modestly to discourage anyone scraping a
// live ladder on a hot loop.
fastify.get('/leaderboard', {
  schema: {
    querystring: {
      type: 'object', additionalProperties: false,
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
    },
  },
  config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
}, async (req) => {
  const limit = Math.min(100, Math.max(1, req.query.limit | 0 || 20));
  const rows = queries.topPlayersByElo.all(limit);
  return { players: rows, ts: Date.now() };
});

// ─── /stats ──────────────────────────────────────────────────────────────
// Public — no auth, just current activity numbers for the client's status
// widget. "Online" = a player whose last_seen has been bumped within the
// recent window (5 min by default, overridable via env). last_seen ticks on
// every authenticated request, so this maps to active gameplay sessions.
const ACTIVE_WINDOW_MS = parseInt(process.env.POKEMINI_ACTIVE_WINDOW_MS || (5 * 60 * 1000), 10);
fastify.get('/stats', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
  async () => {
    const since = Date.now() - ACTIVE_WINDOW_MS;
    const { n: online } = queries.countActivePlayersSince.get(since);
    const { n: total }  = queries.countTotalPlayers.get();
    return { online, total, ts: Date.now() };
  });

// ─── /player/claim ────────────────────────────────────────────────────────
// First-time call mints a token for the name; subsequent calls from the same
// owner can re-fetch it (legacy migration path) but a different requester gets
// 409. Tight rate limit — five tries per minute per IP, since the only legitimate
// reason to hit this is the username setup screen.
fastify.post('/player/claim', {
  schema: {
    body: {
      type: 'object', additionalProperties: false, required: ['name'],
      properties: { name: { type: 'string', pattern: playerNamePattern } },
    },
  },
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
}, async (req, rep) => {
  const result = claimPlayerName(req.body.name);
  if (!result.ok) return rep.code(409).send({ error: 'name_taken' });
  // Fire-and-forget country resolution. The claim returns immediately so the
  // user doesn't wait on an external HTTP round-trip; the country fills in on
  // the background task and is visible the next time the player row is read.
  // If the lookup fails (timeout, rate-limit, etc.) country stays NULL and
  // can be retried later via /player/refresh-country.
  lookupCountry(req.ip).then(country => {
    if (country) queries.setPlayerCountry.run({ id: result.player.id, country });
  }).catch(() => {});
  return { player: result.player.name, token: result.token, elo: result.player.elo | 0 };
});

// ─── /player/refresh-country ─────────────────────────────────────────────
// Manual retry path — tries the geo-IP lookup again and overwrites the stored
// country if it succeeds. Useful when the original lookup at signup failed,
// or when a player has moved / wants to update their flag. Tight rate limit
// since this is a one-off action, not a hot path.
fastify.post('/player/refresh-country', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token'],
      properties: { ...authProps },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 2, timeWindow: '1 minute' } },
}, async (req) => {
  const country = await lookupCountry(req.ip);
  if (country) queries.setPlayerCountry.run({ id: req.authPlayer.id, country });
  return { country };
});

// ─── /player/sync-elo ────────────────────────────────────────────────────
// One-shot migration endpoint: real players accumulated ELO client-side only
// (the per-battle /pvp/result endpoint was never wired up from the client, so
// the server's players.elo column has been stuck at 0 since each account was
// claimed). This endpoint lets a client report its local ELO ONCE — server
// only adopts the value if its own current is 0, so subsequent calls (or
// shenanigans like editing localStorage to inflate a number) can't override
// legit server-side ELO.
//
// Capped at SYNC_ELO_CAP so an attacker who only just claimed a name can't
// silently set themselves to a stratospheric value. Existing players above
// the cap can earn the rest back through normal /run/end progression.
const SYNC_ELO_CAP = parseInt(process.env.POKEMINI_SYNC_ELO_CAP || '2000', 10);
fastify.post('/player/sync-elo', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token', 'clientElo'],
      properties: {
        ...authProps,
        clientElo: { type: 'integer', minimum: 0, maximum: 10000 },
      },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 5, timeWindow: '1 minute' } },
}, async (req) => {
  const serverElo = req.authPlayer.elo | 0;
  const clientElo = Math.min(SYNC_ELO_CAP, Math.max(0, req.body.clientElo | 0));
  if (serverElo === 0 && clientElo > 0) {
    queries.updatePlayerElo.run({ elo: clientElo, ts: Date.now(), id: req.authPlayer.id });
    return { elo: clientElo, synced: true };
  }
  return { elo: serverElo, synced: false };
});

// ─── /run/start ───────────────────────────────────────────────────────────
fastify.post('/run/start', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token'],
      properties: {
        ...authProps,
        mode: { type: 'string', enum: ['singleplayer', 'ranked'] },
        seed: { type: ['integer', 'string', 'null'] },
      },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 30, timeWindow: '1 minute' } },
}, async (req) => {
  const { mode, seed } = req.body;
  const info = queries.insertRun.run({ playerId: req.authPlayer.id, mode: mode || 'singleplayer', ts: Date.now() });
  return { runId: info.lastInsertRowid, playerId: req.authPlayer.id, seed: seed ?? Date.now() };
});

// ─── /run/end ─────────────────────────────────────────────────────────────
// Drops a snapshot for ranked finishers. ELO is NOT trusted from the body —
// /pvp/result is the authoritative ELO mutation path. We accept the client's
// reported team purely as a future-opponent contribution, and bound everything.
fastify.post('/run/end', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token', 'mode', 'result'],
      properties: {
        ...authProps,
        mode:   { type: 'string', enum: ['singleplayer', 'ranked'] },
        result: { type: 'string', enum: ['won', 'lost', 'aborted'] },
        zone:   { type: 'integer', minimum: 1, maximum: 7 },
        badges: { type: 'integer', minimum: 0, maximum: 7 },
        team:   teamSchema,
      },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 30, timeWindow: '1 minute' } },
}, async (req) => {
  const { mode, zone, badges, team } = req.body;
  // ELO mutation — badge-based, server-authoritative. Mirrors the client's
  // ELO_BY_BADGES table (phases.js#eloDeltaForRun). Run-end is the only place
  // ranked ELO moves (per-battle /pvp/result endpoint stays dead — kept for
  // potential per-fight ELO down the line). Forfeit penalty is its own
  // separate path via /pvp/forfeit.
  //   0 badges: -150   1 badge: -100   2 badges:  -50   3 badges:    0
  //   4 badges:  +75   5 badges (won): +250
  const ELO_BY_BADGES = [-150, -100, -50, 0, 75, 250];
  let newElo = req.authPlayer.elo | 0;
  let delta = 0;
  if (mode === 'ranked') {
    const safeBadges = Math.max(0, Math.min(5, badges | 0));
    delta = ELO_BY_BADGES[safeBadges];
    if (delta !== 0) {
      newElo = Math.max(0, (req.authPlayer.elo | 0) + delta);
      queries.updatePlayerElo.run({ elo: newElo, ts: Date.now(), id: req.authPlayer.id });
    }
    if (team && team.length) {
      writeSnapshot({
        zone, badges, strikes: 3,
        elo: newElo,            // post-delta value for matchmaking bucket
        runId: null, playerName: req.authPlayer.name, team,
      });
    }
  }
  return { ok: true, newElo, delta };
});

// ─── /pvp/match ───────────────────────────────────────────────────────────
fastify.post('/pvp/match', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token', 'zone', 'team'],
      properties: {
        ...authProps,
        zone:    { type: 'integer', minimum: 1, maximum: 7 },
        badges:  { type: 'integer', minimum: 0, maximum: 7 },
        strikes: { type: 'integer', minimum: 0, maximum: 3 },
        team:    teamSchema,
      },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (req) => {
  const { zone, badges = 0, strikes = 3, team } = req.body;
  // Use server-side ELO for bucket selection — the client doesn't get a vote here.
  const elo = req.authPlayer.elo | 0;
  const opponent = findOpponent({ zone, badges, strikes, elo, excludeName: req.authPlayer.name });
  if (team && team.length) {
    writeSnapshot({ zone, badges, strikes, elo, runId: null, playerName: req.authPlayer.name, team });
  }
  return opponent;
});

// ─── /pvp/result ──────────────────────────────────────────────────────────
// ELO mutation. Reads current ELO from the player row, applies the delta, writes
// it back — the client's `elo` field would be silently discarded, so we don't
// accept it at all.
fastify.post('/pvp/result', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token', 'won', 'round'],
      properties: {
        ...authProps,
        won:   { type: 'boolean' },
        round: { type: 'integer', minimum: 1, maximum: 20 },
      },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 10, timeWindow: '1 minute' } },
}, async (req) => {
  const { won, round } = req.body;
  const oldElo = req.authPlayer.elo | 0;
  const delta = eloDelta(round, !!won);
  const newElo = Math.max(0, oldElo + delta * 50);
  queries.updatePlayerElo.run({ elo: newElo, ts: Date.now(), id: req.authPlayer.id });
  return { newElo, delta };
});

// ─── /pvp/forfeit ─────────────────────────────────────────────────────────
// Player abandoned a ranked run before its natural end. Apply a fixed forfeit
// penalty (equivalent to ~3 ranked match losses) so abandoning isn't a free way
// to escape a bad bracket. Penalty is configurable via POKEMINI_FORFEIT_PENALTY.
const FORFEIT_PENALTY = parseInt(process.env.POKEMINI_FORFEIT_PENALTY || '150', 10);
fastify.post('/pvp/forfeit', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token'],
      properties: { ...authProps },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 5, timeWindow: '1 minute' } },
}, async (req) => {
  const oldElo = req.authPlayer.elo | 0;
  const newElo = Math.max(0, oldElo - FORFEIT_PENALTY);
  queries.updatePlayerElo.run({ elo: newElo, ts: Date.now(), id: req.authPlayer.id });
  return { newElo, delta: newElo - oldElo };
});

// ─── /pvp/snapshots ───────────────────────────────────────────────────────
// Batch insert — client periodically drains its local snapshot queue here.
// Each snapshot's player_name is OVERWRITTEN with the authenticated name to
// prevent submitting on someone else's behalf. Hard-capped batch size matches
// the client's MAX_LOCAL of 500.
fastify.post('/pvp/snapshots', {
  schema: {
    body: {
      type: 'object', additionalProperties: false,
      required: ['player', 'token', 'snapshots'],
      properties: {
        ...authProps,
        snapshots: {
          type: 'array', minItems: 1, maxItems: 500,
          items: {
            type: 'object', additionalProperties: true,
            required: ['roster', 'zone'],
            properties: {
              kind:      { type: ['string', 'null'], maxLength: 32 },
              mode:      { type: ['string', 'null'], maxLength: 16 },
              elo:       { type: ['integer', 'null'], minimum: 0, maximum: 10000 },
              badges:    { type: ['integer', 'null'], minimum: 0, maximum: 7 },
              zone:      { type: 'integer', minimum: 1, maximum: 7 },
              seed:      { type: ['integer', 'string', 'null'] },
              timestamp: { type: ['integer', 'null'] },
              roster:    teamSchema,
            },
          },
        },
      },
    },
  },
  config: { requiresAuth: true, rateLimit: { max: 5, timeWindow: '1 minute' } },
}, async (req) => {
  const playerName = req.authPlayer.name;
  let accepted = 0;
  for (const s of req.body.snapshots) {
    writeSnapshot({
      zone: s.zone,
      badges: s.badges | 0,
      strikes: 3,
      elo: req.authPlayer.elo | 0,    // server-side, not client value
      runId: null,
      playerName,
      team: s.roster,
    });
    accepted++;
  }
  return { ok: true, accepted };
});

// ─── /shop/town ───────────────────────────────────────────────────────────
// Stateless — anyone can hit it. Still rate-limit-bound by the global cap.
fastify.post('/shop/town', async () => {
  const ITEMS = ['repel','tradeCard','revive','xVitamin','greatBall','evosoda','tm','hm','lure'];
  const out = ITEMS.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  return { items: out };
});

// Background prune every hour
setInterval(pruneOld, 60 * 60 * 1000).unref?.();

const PORT = parseInt(process.env.PORT || '3000', 10);
// In production we bind to localhost — nginx is the only entry point. Override
// with POKEMINI_HOST=0.0.0.0 if you really need direct external access.
const HOST = process.env.POKEMINI_HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');
try {
  await fastify.listen({ port: PORT, host: HOST });
  fastify.log.info(`PokeMini server listening on ${HOST}:${PORT}`);
} catch (e) { fastify.log.error(e); process.exit(1); }
