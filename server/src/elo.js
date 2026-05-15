// ELO delta per round (see GDD §10). Singleplayer never invokes this.
export function eloDelta(round, won) {
  if (won) {
    if (round >= 7) return 5;
    return 5;            // any PvP win pays +5; full clear pays +5 (see GDD)
  }
  if (round <= 2) return -2;
  if (round <= 4) return 0;
  if (round === 5) return 1;
  if (round === 6) return 2;
  return 3;              // round 7+
}

export function eloBucket(elo) { return Math.floor(elo / 100); }
