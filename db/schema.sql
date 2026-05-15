-- PokeMini SQLite schema
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  elo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  -- claim_token: random opaque string issued at first /player/claim. The client stores
  -- it in localStorage and MUST present it on every authenticated request. Once set,
  -- a player name is locked to that token — no one else can claim it. NULL on legacy
  -- rows; the first claim attempt against such a row mints a token (migration window).
  claim_token TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_ci ON players(name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  result TEXT,
  zone INTEGER NOT NULL DEFAULT 1,
  badges INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 3,
  money INTEGER NOT NULL DEFAULT 0,
  elo_delta INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS snapshots (
  zone INTEGER NOT NULL,
  badges INTEGER NOT NULL,
  strikes INTEGER NOT NULL,
  elo_bucket INTEGER NOT NULL,
  run_id INTEGER,
  player_name TEXT,
  team_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_match ON snapshots(zone, badges, strikes, elo_bucket, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_elo ON players(elo DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_player ON snapshots(player_name COLLATE NOCASE, created_at DESC);
