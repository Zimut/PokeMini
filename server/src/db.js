import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.POKEMINI_DB || path.resolve(__dirname, '../../db/pokemini.db');
const SCHEMA_PATH = path.resolve(__dirname, '../../db/schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

if (fs.existsSync(SCHEMA_PATH)) {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

// ─── Runtime migrations ───────────────────────────────────────────────────
// `CREATE TABLE IF NOT EXISTS` only fires on first install — it does NOT add
// columns to a table that already exists. So we sniff the current schema and
// apply ALTER TABLE statements as needed. Each migration is idempotent.
function tableHasColumn(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some(r => r.name === column);
}
if (!tableHasColumn('players', 'claim_token')) {
  db.exec('ALTER TABLE players ADD COLUMN claim_token TEXT');
}
if (!tableHasColumn('players', 'country')) {
  db.exec('ALTER TABLE players ADD COLUMN country TEXT');
}
// One-per-(player, run) snapshot rule — enforce on existing data on every startup.
// Idempotent: once collapsed, the EXISTS subquery finds nothing newer for any (player,
// run_id) pair and the DELETE is a no-op. Rows with NULL run_id are left alone (legacy
// pre-tracking writes) — they'll age out via the 24h prune. Anonymous snapshots also
// untouched. The new rule preserves variety: a player who completes multiple runs ends
// up with one snapshot per run in the pool, instead of being collapsed to a single
// entry that gets nuked on every new /pvp/match write.
const dupCleanup = db.prepare(`
  DELETE FROM snapshots
  WHERE player_name IS NOT NULL AND player_name <> ''
    AND run_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM snapshots s2
      WHERE s2.player_name = snapshots.player_name COLLATE NOCASE
        AND s2.run_id      = snapshots.run_id
        AND s2.created_at  > snapshots.created_at
    )
`).run();
if (dupCleanup.changes > 0) {
  console.log(`[snapshots] cleanup: dropped ${dupCleanup.changes} older per-(player,run) rows`);
}

export default db;

// ─── Helpers ──────────────────────────────────────────────────────────────
const now = () => Date.now();

export const queries = {
  // Players
  upsertPlayer: db.prepare(`INSERT INTO players (id, name, elo, created_at, last_seen, claim_token)
    VALUES (@id, @name, @elo, @ts, @ts, @claimToken)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen`),
  getPlayerByName:   db.prepare(`SELECT * FROM players WHERE name = ? COLLATE NOCASE`),
  setPlayerToken:    db.prepare(`UPDATE players SET claim_token = @token, last_seen = @ts WHERE id = @id`),
  touchPlayerSeen:   db.prepare(`UPDATE players SET last_seen = @ts WHERE id = @id`),
  updatePlayerElo:   db.prepare(`UPDATE players SET elo = @elo, last_seen = @ts WHERE id = @id`),

  // Runs
  insertRun:  db.prepare(`INSERT INTO runs (player_id, mode, started_at, zone, badges, strikes, money)
    VALUES (@playerId, @mode, @ts, 1, 0, 3, 1000)`),
  endRunSql:  db.prepare(`UPDATE runs SET ended_at = @ts, result = @result, zone = @zone, badges = @badges, elo_delta = @eloDelta WHERE id = @id`),

  // Snapshots — write / match / prune
  insertSnapshot: db.prepare(`INSERT INTO snapshots (zone, badges, strikes, elo_bucket, run_id, player_name, team_json, created_at)
    VALUES (@zone, @badges, @strikes, @eloBucket, @runId, @playerName, @teamJson, @ts)`),
  // Flexible matcher — caller passes WIDE filter ranges plus TARGET values; the
  // query returns the closest available snapshot via ORDER BY distance. The
  // caller's cascade (findOpponent) controls how aggressively to widen the
  // filters between tries, but a single query body handles the actual "give me
  // the best one in this range" lookup. RANDOM() is the final tiebreaker so
  // repeat matchmaking against an identical-distance set still varies opponents.
  matchSnapshot: db.prepare(`SELECT * FROM snapshots
    WHERE zone   BETWEEN @zoneMin    AND @zoneMax
      AND badges BETWEEN @badgesMin  AND @badgesMax
      AND strikes BETWEEN @strikesMin AND @strikesMax
      AND elo_bucket BETWEEN @bucketMin AND @bucketMax
      AND created_at > @minAge
      AND (player_name IS NULL OR player_name <> @excludeName COLLATE NOCASE)
    ORDER BY
      ABS(zone    - @zoneTarget),
      ABS(badges  - @badgesTarget),
      ABS(strikes - @strikesTarget),
      ABS(elo_bucket - @bucketTarget),
      RANDOM()
    LIMIT 1`),
  pruneSnapshots: db.prepare(`DELETE FROM snapshots WHERE created_at < ?`),

  // Stats — count of distinct players who hit any authenticated endpoint in the
  // recent window. last_seen is bumped by touchPlayerSeen (every verifyPlayer)
  // and updatePlayerElo, so it tracks real activity.
  countActivePlayersSince: db.prepare(
    `SELECT COUNT(*) AS n FROM players WHERE last_seen >= ?`),
  countTotalPlayers: db.prepare(`SELECT COUNT(*) AS n FROM players`),
  // Top-N players by ELO for the leaderboard widget. last_seen as a tiebreaker
  // keeps the order stable when multiple players sit at exactly the same ELO.
  topPlayersByElo: db.prepare(
    `SELECT name, elo, country FROM players ORDER BY elo DESC, last_seen DESC LIMIT ?`),
  // Country update — set by /player/claim's fire-and-forget geo-IP lookup or by
  // /player/refresh-country (manual retry). Stored as 2-letter ISO code.
  setPlayerCountry: db.prepare(
    `UPDATE players SET country = @country WHERE id = @id`),

  // Per-player snapshot cap — count + delete-oldest, kept around for any future
  // flood-control use. Day-to-day dedup is now handled by deleteSnapshotsForPlayerRun
  // below (one snapshot per player per run).
  countSnapshotsForPlayer: db.prepare(
    `SELECT COUNT(*) AS n FROM snapshots WHERE player_name = ? COLLATE NOCASE`),
  pruneOldestForPlayer: db.prepare(`
    DELETE FROM snapshots
    WHERE rowid IN (
      SELECT rowid FROM snapshots
      WHERE player_name = @name COLLATE NOCASE
      ORDER BY created_at DESC
      LIMIT -1 OFFSET @keep
    )`),
  // Per-(player, run) dedup — called by writeSnapshot before insert so a single run
  // is represented by at most one snapshot in the pool (its latest write). Multiple
  // runs from the same player coexist freely. Both args must match: same case-
  // insensitive name AND same run_id integer.
  deleteSnapshotsForPlayerRun: db.prepare(
    `DELETE FROM snapshots WHERE player_name = @name COLLATE NOCASE AND run_id = @runId`),
};

// ─── Player creation / claim ─────────────────────────────────────────────
// Issue a fresh random token. 128 bits of entropy, URL-safe.
export function makeClaimToken() {
  return crypto.randomBytes(16).toString('base64url');
}

// Either:
//   • Create a new player with `name`, mint and return a token.
//   • Re-issue token to a legacy (token-less) row (one-time migration).
//   • Reject if a token already exists for this name.
//
// Returns { ok: true, player, token } on success, or
//         { ok: false, reason: 'taken' } if someone else owns it.
export function claimPlayerName(name) {
  const existing = queries.getPlayerByName.get(name);
  const ts = now();
  if (!existing) {
    const id = crypto.randomUUID();
    const token = makeClaimToken();
    queries.upsertPlayer.run({ id, name, elo: 0, ts, claimToken: token });
    return { ok: true, player: queries.getPlayerByName.get(name), token };
  }
  if (existing.claim_token) {
    return { ok: false, reason: 'taken' };
  }
  // Legacy row, no token yet — migrate by minting one and locking it in.
  const token = makeClaimToken();
  queries.setPlayerToken.run({ id: existing.id, token, ts });
  return { ok: true, player: { ...existing, claim_token: token }, token };
}

// Look up `name` and verify `token` matches. Returns the player row on success,
// or `null` on any failure (no such name, wrong token, no token issued yet).
// Uses constant-time comparison to defeat timing attacks on the token value.
export function verifyPlayer(name, token) {
  if (!name || !token) return null;
  const row = queries.getPlayerByName.get(name);
  if (!row || !row.claim_token) return null;
  const a = Buffer.from(row.claim_token);
  const b = Buffer.from(token);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  queries.touchPlayerSeen.run({ id: row.id, ts: now() });
  return row;
}

// Convenience for endpoints that don't need auth but still want to upsert a
// player row (e.g. legacy /run/start without a token). Returns the player row.
// New behavior: this no longer mints a token — only claimPlayerName does that.
export function ensurePlayer(name) {
  const existing = queries.getPlayerByName.get(name);
  if (existing) return existing;
  const id = crypto.randomUUID();
  queries.upsertPlayer.run({ id, name, elo: 0, ts: now(), claimToken: null });
  return queries.getPlayerByName.get(name);
}
