import { queries } from './db.js';
import { eloBucket } from './elo.js';

// Build a fallback gym-leader roster scaled to the zone level.
// Mirrors client data; canonical mapping is duplicated here to avoid client/server import dance.
const ZONE_LEVELS = [8, 16, 24, 32, 40, 48, 56];
const GYM_LEADER_TEAMS = [
  // Brock
  [{ id:74, lvl:0 }, { id:95, lvl:2 }],
  // Misty
  [{ id:118, lvl:0 }, { id:119, lvl:4 }],
  // Lt. Surge
  [{ id:100, lvl:0 }, { id:25, lvl:2 }, { id:26, lvl:4 }],
  // Erika
  [{ id:71, lvl:0 }, { id:114, lvl:2 }, { id:45, lvl:4 }],
  // Koga
  [{ id:109, lvl:0 }, { id:89, lvl:2 }, { id:109, lvl:0 }, { id:110, lvl:4 }],
  // Sabrina
  [{ id:64, lvl:0 }, { id:122, lvl:2 }, { id:65, lvl:4 }],
  // Blaine
  [{ id:58, lvl:-2 }, { id:38, lvl:0 }, { id:59, lvl:4 }],
];

function buildGymLeaderRoster(zone) {
  const team = GYM_LEADER_TEAMS[zone - 1] || GYM_LEADER_TEAMS[0];
  const level = ZONE_LEVELS[zone - 1];
  // Gym leader Pokémon are always at the zone's max level.
  return team.map((m, i) => ({
    speciesId: m.id, level,
    slot: i < 3 ? 'F' + (i + 1) : 'B' + (i - 2),
  }));
}

const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Per-player cap — one player can have at most this many fresh snapshots in the
// matchmaking pool. New writes past the cap delete the player's oldest rows so
// the pool stays representative and no single player can flood it.
const PER_PLAYER_SNAPSHOT_CAP = 20;

export function findOpponent({ zone, badges, strikes, elo, excludeName = '' }) {
  const bucket = eloBucket(elo);
  const minAge = Date.now() - SNAPSHOT_MAX_AGE_MS;
  // Widen bucket search if needed. excludeName prevents matching against
  // yourself — the player's own recent snapshot is otherwise a perfect bucket
  // hit and would dominate matchmaking.
  for (const range of [0, 1, 2, 5, 100]) {
    const snap = queries.matchSnapshot.get({
      zone, badges, strikes,
      bucketMin: bucket - range, bucketMax: bucket + range, minAge,
      excludeName: excludeName || '',
    });
    if (snap) return { source: 'snapshot', roster: JSON.parse(snap.team_json), opponentName: snap.player_name || 'Ghost' };
  }
  // Fallback: gym leader for this zone
  return { source: 'gym', roster: buildGymLeaderRoster(zone), opponentName: `Gym Leader ${zone}` };
}

export function writeSnapshot({ zone, badges, strikes, elo, runId, playerName, team }) {
  queries.insertSnapshot.run({
    zone, badges, strikes, eloBucket: eloBucket(elo),
    runId, playerName, teamJson: JSON.stringify(team), ts: Date.now(),
  });
  // Enforce the per-player cap. We check count first so the prune query (which
  // is range-scanning) only runs when we'd actually exceed.
  if (playerName) {
    const { n } = queries.countSnapshotsForPlayer.get(playerName);
    if (n > PER_PLAYER_SNAPSHOT_CAP) {
      queries.pruneOldestForPlayer.run({ name: playerName, keep: PER_PLAYER_SNAPSHOT_CAP });
    }
  }
}

export function pruneOld() {
  queries.pruneSnapshots.run(Date.now() - SNAPSHOT_MAX_AGE_MS);
}
