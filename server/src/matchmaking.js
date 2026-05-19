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

// Cascade — each pass relaxes more filters within the SAME zone. We never widen
// across zones because the level difference between zones (≈7 levels per step)
// makes cross-zone matches strategically meaningless. `lockBadges` / `lockStrikes`
// toggle whether the filter is restricted to the exact value or allowed to span
// the full possible range. `eloRange` widens the ELO bucket search.
//
// The single-query distance ORDER BY picks the closest available snapshot in
// whatever window the pass opens up, so we always get the best match in the
// loosest pass that actually has data — never a worse one from a tighter pass
// that already missed. If every same-zone pass misses, the gym leader fallback
// fires (the player's zone has zero usable snapshots).
const MATCH_PASSES = [
  // Tight bracket — exact badges/strikes, ELO ±1 bucket (±100 ELO)
  { lockBadges: true,  lockStrikes: true,  eloRange: 1   },
  // Widen ELO — same bracket, ELO ±5 buckets (±500 ELO)
  { lockBadges: true,  lockStrikes: true,  eloRange: 5   },
  // Drop strikes lock — find players who match on badges, any strikes, wider
  // ELO. Key fix for "lost a strike → bracket goes empty".
  { lockBadges: true,  lockStrikes: false, eloRange: 5   },
  // Drop badges lock too — anyone in this zone, any ELO bucket. Last attempt
  // before gym fallback.
  { lockBadges: false, lockStrikes: false, eloRange: 100 },
];

export function findOpponent({ zone, badges, strikes, elo, excludeName = '' }) {
  const bucket = eloBucket(elo);
  const minAge = Date.now() - SNAPSHOT_MAX_AGE_MS;
  for (const p of MATCH_PASSES) {
    const snap = queries.matchSnapshot.get({
      // Hard filter bounds — zone is ALWAYS exact, only badges/strikes/ELO relax
      zoneMin:    zone,
      zoneMax:    zone,
      badgesMin:  p.lockBadges  ? badges  : 0,
      badgesMax:  p.lockBadges  ? badges  : 99,
      strikesMin: p.lockStrikes ? strikes : 0,
      strikesMax: p.lockStrikes ? strikes : 99,
      bucketMin:  bucket - p.eloRange,
      bucketMax:  bucket + p.eloRange,
      // Target values — ORDER BY uses these to pick the closest snapshot within
      // the filter window
      zoneTarget:    zone,
      badgesTarget:  badges,
      strikesTarget: strikes,
      bucketTarget:  bucket,
      minAge,
      excludeName: excludeName || '',
    });
    if (snap) {
      return { source: 'snapshot', roster: JSON.parse(snap.team_json), opponentName: snap.player_name || 'Ghost' };
    }
  }
  // Gym leader for this zone — no real player snapshots in this zone at all
  // (within the freshness window). Should be rare once the playerbase has a
  // few active players per zone.
  return { source: 'gym', roster: buildGymLeaderRoster(zone), opponentName: `Gym Leader ${zone}` };
}

export function writeSnapshot({ zone, badges, strikes, elo, runId, playerName, team }) {
  // Single-run-per-player rule: when a write comes in for (player, run X), wipe every
  // OTHER snapshot from that player whose run isn't X (plus any legacy NULL-run rows),
  // then insert. Within run X, snapshots accumulate — one per battle/zone — giving
  // matchmakers a team from that player at every zone they've reached. Starting a new
  // run (different seed → different runId) wholesale replaces the player's pool entries
  // with the new run's snapshots as they trickle in.
  //
  // Writes without a runId (anonymous batches, legacy clients) skip the dedup and just
  // insert — they'll age out via the 24h prune. We don't wipe other players' rows in
  // that case because we can't tie the write to a specific run.
  if (playerName && runId != null) {
    queries.deleteOtherRunsForPlayer.run({ name: playerName, runId });
  }
  queries.insertSnapshot.run({
    zone, badges, strikes, eloBucket: eloBucket(elo),
    runId, playerName, teamJson: JSON.stringify(team), ts: Date.now(),
  });
}

export function pruneOld() {
  queries.pruneSnapshots.run(Date.now() - SNAPSHOT_MAX_AGE_MS);
}
