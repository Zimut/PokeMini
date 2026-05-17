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

// ─── /health ──────────────────────────────────────────────────────────────
fastify.get('/health', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
  async () => ({ ok: true, ts: Date.now() }));

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
  return { player: result.player.name, token: result.token, elo: result.player.elo | 0 };
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
  if (mode === 'ranked' && team && team.length) {
    writeSnapshot({
      zone, badges, strikes: 3,
      elo: req.authPlayer.elo | 0,            // server-side, not client-supplied
      runId: null, playerName: req.authPlayer.name, team,
    });
  }
  return { ok: true };
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
