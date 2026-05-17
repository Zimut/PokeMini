// PokeMini battle engine — deterministic, seeded, identical in browser and Node.
// Public API:
//   newRng(seed) → rng with .int(n), .float(), .pick(arr), .roll(pct)
//   buildTeam(roster) → BattleTeam (clones with battle state)
//   simulate(teamA, teamB, seed) → { winner: 'A'|'B'|'draw', turns, log }
//   actualStats(species, level) → { hp, atk, spd }

import { SPECIES, typeMult } from './data.js';

// ─── RNG (mulberry32) ─────────────────────────────────────────────────────
export function newRng(seed) {
  let s = (seed >>> 0) || 1;
  function next() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  return {
    float: next,
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    roll: (pct) => next() < pct / 100,
  };
}

// ─── Stat scaling by level ────────────────────────────────────────────────
export function actualStats(species, level) {
  return {
    hp:  Math.floor(species.hp  * level / 20 + level),
    atk: Math.floor(species.atk * level / 50 + 2),
    spd: Math.floor(species.spd * level / 50 + 2),
  };
}

// ─── Battle Pokemon factory ───────────────────────────────────────────────
function makeBp(member, sideKey, slot) {
  const sp = SPECIES[member.speciesId];
  if (!sp) throw new Error(`unknown species ${member.speciesId}`);
  // Shiny members get the +15% base-stat boost applied before bonuses. The shiny
  // flag is carried on the BP so the battle renderer can swap to the shiny sprite.
  const shiny = !!member.shiny;
  const rawStats = actualStats(sp, member.level);
  const stats = shiny
    ? { hp: Math.round(rawStats.hp * 1.15), atk: Math.round(rawStats.atk * 1.15), spd: Math.round(rawStats.spd * 1.15) }
    : rawStats;
  // Berry/TM/HM/Evosoda modifications applied via member fields
  let hpMax = stats.hp + (member.hpBonus || 0);
  let atk   = stats.atk + (member.atkBonus || 0);
  let spd   = stats.spd + (member.spdBonus || 0);
  // Honor a pre-existing fainted state passed in via the roster (e.g., a Pokémon that
  // fainted in a prior trainer battle and hasn't been revived). Those start the battle
  // already KO'd: visible in the arena but greyed out and unable to act.
  const preFainted = !!member.fainted;
  return {
    side: sideKey, slot, species: sp,
    name: sp.name, level: member.level,
    type1: member.type1 || sp.type1, type2: member.type2 || sp.type2,
    abilityId: member.abilityOverride || sp.ability,
    hp: preFainted ? 0 : hpMax, hpMax, atk, spd,
    shiny,                                  // carried through to the animation snapshot
    statMods: { atk: 1, spd: 1 },           // multiplicative modifiers
    stun: 0,                                // turns of skip-action remaining
    burn: 0,                                // counter X
    poison: 0,                              // counter Y
    fainted: preFainted,
    runAwayUsed: false,
    restUsed: false,
    moxieStacks: 0,
    coilStacks: 0,
    skipTurns: 0,                           // for Sky High etc. (legacy — kept for any future ability that needs to skip a turn)
    untargetable: 0,                        // Sky High — can attack but enemies can't target it
    flagged: {},                            // per-ability flags
    onTurnFlags: {},
  };
}

export function buildTeam(roster, sideKey) {
  // roster: array of up to 6 members with { speciesId, level, slot ('F1'..'B3'), hpBonus, atkBonus, spdBonus, type2, abilityOverride }
  const team = { side: sideKey, units: [], byPos: {} };
  for (const m of roster) {
    const bp = makeBp(m, sideKey, m.slot);
    uid(bp);  // pre-assign uid
    team.units.push(bp);
    team.byPos[m.slot] = bp;
  }
  return team;
}

// Stable per-battle id for log addressing. Each unit gets a unique uid baked into log entries.
let _uidCounter = 0;
export function uid(u) {
  if (u._uid == null) u._uid = ++_uidCounter;
  return u._uid;
}

// Emit an "ability shout" log event — the UI shows the ability name floating above the unit.
function shout(unit, name, log) {
  if (!log || !unit) return;
  log.push({ t: 'ability', name, who: uid(unit), side: unit.side, slot: unit.slot });
}

// Heal a target by `amount`. Caps at hpMax. Emits a heal event so the UI animates.
// If bumpMax is true (Stamina), the heal also raises max HP and we log that.
// `source` is the unit credited for the heal (used by the in-battle damage counter UI).
function heal(target, amount, log, bumpMax = false, source = null) {
  if (!target || target.fainted || amount <= 0) return 0;
  const fromUid = source ? uid(source) : null;
  if (bumpMax) {
    target.hpMax += amount;
    target.hp += amount;
    if (log) log.push({ t: 'heal', who: uid(target), side: target.side, slot: target.slot, amount, bumpMax: true, from: fromUid });
    return amount;
  }
  const actual = Math.min(amount, target.hpMax - target.hp);
  if (actual <= 0) return 0;
  target.hp += actual;
  if (log) log.push({ t: 'heal', who: uid(target), side: target.side, slot: target.slot, amount: actual, from: fromUid });
  return actual;
}

// Status immunities — a single source of truth.
const STUN_IMMUNE_ABILITIES = new Set(['soundproof','limber','rockHead']);
const ALL_STATUS_IMMUNE_ABILITIES = new Set(['rockHead']);
function canBeStunned(target)  { return !STUN_IMMUNE_ABILITIES.has(target.abilityId); }
function canBeBurned(target)   { return !ALL_STATUS_IMMUNE_ABILITIES.has(target.abilityId) && target.abilityId !== 'magicGuard'; }
function canBePoisoned(target) { return !ALL_STATUS_IMMUNE_ABILITIES.has(target.abilityId) && target.abilityId !== 'magicGuard'; }

// Slots: F1, F2, F3, B1, B2, B3
const SLOTS = ['F1','F2','F3','B1','B2','B3'];
const FRONT = ['F1','F2','F3'];
const BACK  = ['B1','B2','B3'];
const COL_FRONT = { 1:'F1', 2:'F2', 3:'F3' };
const COL_BACK  = { 1:'B1', 2:'B2', 3:'B3' };
function colOf(slot) { return parseInt(slot[1]); }
function isFront(slot) { return slot[0] === 'F'; }

// ─── Synergy helpers ──────────────────────────────────────────────────────
// Mr.Mime's `encore`: when an ally on the same column as a Mr.Mime/Encore unit triggers
// its ability, fire it +1 time. Returns 1 if such a Mr.Mime exists, 0 otherwise.
// (Skipped when u itself has encore — Encore doesn't re-trigger itself.)
function mimicBoost(u, team) {
  if (!u || u.fainted || u.abilityId === 'encore') return 0;
  const col = colOf(u.slot);
  const otherRow = isFront(u.slot) ? 'B' : 'F';
  const ally = team.byPos[otherRow + col];
  // A stunned Mr.Mime can't encore — mirrors the engine-wide pattern of skipping ability
  // triggers for stunned units (onTurnEnd, onTurnStart, fireForTeam all skip stunned).
  if (ally && !ally.fainted && ally.stun === 0 && ally.abilityId === 'encore' && ally !== u) return 1;
  return 0;
}

// Bellsprout-line `photosynthesis`: heals 8/14/20% max HP whenever ANY allied ability
// triggers (including triggers driven by Mr.Mime's encore re-fire). Self does NOT count
// — Bellsprout's own ability has no switch case, so its presence is purely reactive.
// enemyTeam/rng are threaded through so a successful heal can also fire Sunbeam.
function pingPhotosynthesis(triggeringUnit, team, enemyTeam, rng, log) {
  if (!team) return;
  for (const b of team.units) {
    if (b.fainted || b === triggeringUnit) continue;
    if (b.abilityId !== 'photosynthesis') continue;
    const pct = [0.08, 0.14, 0.20][b.species.stage - 1] || 0.08;
    const amt = Math.floor(b.hpMax * pct);
    const healed = heal(b, amt, log, false, b);
    if (healed > 0) {
      shout(b, `+${healed} HP`, log);
      triggerSunbeam(b, enemyTeam, rng, log);
    }
  }
}

// Exeggcute-line `sunbeam`: when any allied unit is healed, sunbeam-holders fire a
// 15/30%-of-normal-damage chip attack at a random enemy. Called from every heal() site.
function triggerSunbeam(healedUnit, enemyTeam, rng, log) {
  if (!healedUnit || !healedUnit.team || !enemyTeam || !rng) return;
  for (const e of healedUnit.team.units) {
    if (e.fainted || e.stun > 0) continue;
    if (e.abilityId !== 'sunbeam') continue;
    const aliveEnemies = enemyTeam.units.filter(x => !x.fainted);
    if (!aliveEnemies.length) break;
    const target = rng.pick(aliveEnemies);
    const pct = [0.15, 0.30][e.species.stage - 1] || 0.15;
    const { dmg, crit, tmult } = calcDamage(e, target, rng);
    const scaled = Math.max(1, Math.floor(dmg * pct));
    shout(e, 'Sunbeam!', log);
    log.push({
      t:'atk', a: uid(e), tgt: uid(target),
      aSide: e.side, aSlot: e.slot,
      tSide: target.side, tSlot: target.slot,
      aName: e.name, tName: target.name,
    });
    dealDamage(e, target, scaled, healedUnit.team, enemyTeam, rng, log, { triggerOnHit: false, crit, tmult, source: 'sunbeam' });
  }
}

// Rattata-line `opportunist`: when an enemy is newly stunned, opportunists on the
// attacking team make a free attack against that enemy. Called from applyStun when
// the call site supplies an attackerTeam context.
function triggerOpportunist(target, attackerTeam, enemyTeam, rng, log) {
  if (!attackerTeam || !enemyTeam || !rng) return;
  for (const u of attackerTeam.units) {
    if (u.fainted || u.stun > 0 || u.skipTurns > 0) continue;
    if (u.abilityId !== 'opportunist') continue;
    if (target.fainted) break;
    shout(u, 'Opportunist!', log);
    doDirectAttack(u, target, attackerTeam, enemyTeam, rng, log);
  }
}

// ─── Targeting ────────────────────────────────────────────────────────────
// Untargetability sources:
//   • `u.untargetable > 0`   — legacy turn counter (kept for future abilities that
//                              want a fixed-duration "intangible" window).
//   • `skyHigh`              — Aerodactyl is untargetable as long as ANY teammate
//                              is still alive. Once it's the last Pokémon standing
//                              it becomes targetable again (otherwise nothing could
//                              ever kill it and the battle would stalemate).
// Pungent Aura taunts override target selection unless the Pungent source itself
// is somehow untargetable.
function isUntargetable(u) {
  if (!u || u.fainted) return true;
  if (u.untargetable > 0) return true;
  if (u.abilityId === 'skyHigh' && u.team) {
    // Targetable only as the last alive teammate.
    const others = u.team.units.filter(x => x !== u && !x.fainted);
    if (others.length > 0) return true;
  }
  return false;
}
function chooseTarget(attacker, enemyTeam, rng) {
  const aliveOf = (slots) => slots.map(s => enemyTeam.byPos[s]).filter(u => u && !u.fainted && !isUntargetable(u));

  // Pungent Aura taunts — all alive Pungent sources (still respect untargetability).
  const taunts = enemyTeam.units.filter(u => u && !u.fainted && !isUntargetable(u) && u.abilityId === 'pungentAura' && u.stun === 0);
  if (taunts.length) return rng.pick(taunts);

  // Limber (Hitmonlee) — attacker targets enemy back row first
  if (attacker.abilityId === 'limber' && attacker.stun === 0) {
    const backAlive = aliveOf(BACK);
    if (backAlive.length) {
      const col = colOf(attacker.slot);
      const sameCol = enemyTeam.byPos[COL_BACK[col]];
      if (sameCol && !sameCol.fainted && !isUntargetable(sameCol)) return sameCol;
      return backAlive.reduce((closest, u) => Math.abs(colOf(u.slot) - col) < Math.abs(colOf(closest.slot) - col) ? u : closest);
    }
  }

  // Standard: front row in own column, else nearest alive front-row, else repeat for back row.
  const col = colOf(attacker.slot);
  for (const slots of [FRONT, BACK]) {
    const alive = aliveOf(slots).filter(u => !u.skipTurns);
    if (!alive.length) continue;
    const sameCol = slots.find(s => colOf(s) === col);
    const direct = enemyTeam.byPos[sameCol];
    if (direct && !direct.fainted && !direct.skipTurns && !isUntargetable(direct)) return direct;
    // nearest by column distance
    return alive.reduce((c, u) => Math.abs(colOf(u.slot) - col) < Math.abs(colOf(c.slot) - col) ? u : c);
  }
  return null;
}

// ─── Damage calc ──────────────────────────────────────────────────────────
function calcDamage(attacker, target, rng, mods = {}) {
  // Crit chance: Cross Chop overrides, else 5% baseline
  let critPct = 5;
  if (attacker.abilityId === 'crossChop' && attacker.stun === 0) {
    const stage = attacker.species.stage || 1;
    critPct = [30, 45, 60][stage - 1] || 30;
  }
  const crit = rng.roll(critPct);
  const critMult = crit ? 2 : 1;

  // Type multiplier — BOTH of the attacker's types count, averaged.
  // The defender's full type pair (t1+t2) is already factored into each typeMult call
  // (it multiplies the row entries together). Averaging the two attacker types prevents
  // dual-type defenders from stacking 4× weakness against a dual-type attacker whose
  // secondary type is neutral or resistant — e.g. Grass/Poison vs Rock/Ground now reads
  // (2×2 + 0.5×0.5) / 2 = 2.125× instead of the old 4×. Mono-type attackers are
  // unchanged: averaging a single value returns the same value.
  const atkTypes = [attacker.type1, attacker.type2].filter(Boolean);
  const defTypes = [target.type1, target.type2];
  const tmult = atkTypes.length
    ? atkTypes.reduce((s, t) => s + typeMult(t, defTypes), 0) / atkTypes.length
    : 1;

  let dmg = attacker.atk * attacker.statMods.atk * tmult * critMult;
  // Predator bonus
  if (attacker.abilityId === 'predator' && target.hp / target.hpMax < 0.5) dmg *= 1.5;
  // (vitalSpirit retired — Mankey line now uses `angerPoint`, handled in onFaint.)
  // Water Veil: ≥75% HP → bonus damage
  if (attacker.abilityId === 'waterVeil' && attacker.hp / attacker.hpMax >= 0.75) {
    dmg *= [1.1, 1.2, 1.3][attacker.species.stage - 1];
  }
  // Iron Fist (Hitmonchan): every 2nd attack +50%
  if (attacker.abilityId === 'ironFist') {
    attacker.flagged.attacks = (attacker.flagged.attacks || 0) + 1;
    if (attacker.flagged.attacks % 2 === 0) dmg *= 1.5;
  }
  // Rollout: + 15/30% of SPD as flat damage
  if (attacker.abilityId === 'rollout' && attacker.stun === 0) {
    const stage = attacker.species.stage || 1;
    dmg += attacker.spd * (stage === 1 ? 0.15 : 0.30);
  }
  // Body Slam (Snorlax) — adds 20% of current HP as flat damage. Scales down naturally
  // as Snorlax takes damage, rewarding keeping it healthy.
  if (attacker.abilityId === 'bodySlam' && attacker.stun === 0) {
    dmg += attacker.hp * 0.20;
  }

  // Withdraw — target damage reduction
  if (target.abilityId === 'withdraw' && target.stun === 0) {
    dmg *= 1 - [0.15, 0.30][target.species.stage - 1];
  }
  // Shell Bash (Squirtle line) — applies the accumulated damage reduction this Pokémon
  // has built up from previous hits. The stack itself is incremented in dealDamage AFTER
  // damage is applied, so each new hit benefits from prior stacks (not its own).
  if (target.abilityId === 'shellBash' && target.flagged.shellBashDR) {
    dmg *= 1 - target.flagged.shellBashDR / 100;
  }
  // Marvel Scale — damage reduction while suffering any status
  if (target.abilityId === 'marvelScale' && target.stun === 0
      && (target.burn > 0 || target.poison > 0)) {
    dmg *= 1 - [0.25, 0.35, 0.50][target.species.stage - 1];
  }
  // Battle Armor — row aura
  for (const u of target.team?.units || []) {
    if (u !== target && u.abilityId === 'battleArmor' && !u.fainted && u.stun === 0
        && isFront(u.slot) === isFront(target.slot)) {
      dmg *= 1 - [0.08, 0.15][u.species.stage - 1];
    }
  }

  return { dmg: Math.max(1, Math.floor(dmg)), crit, tmult };
}

// ─── Status effect application ────────────────────────────────────────────
function applyBurn(target, x, log) {
  if (target.fainted || !canBeBurned(target)) return;
  target.burn += x;
  if (log) log.push({ t:'applyBurn', who: uid(target), side: target.side, slot: target.slot, amount: x });
}
function applyPoison(target, y, log) {
  if (target.fainted || !canBePoisoned(target)) return;
  target.poison += y;
  if (log) log.push({ t:'applyPoison', who: uid(target), side: target.side, slot: target.slot, amount: y });
}
function applyStun(target, n, log, ctx) {
  if (target.fainted || !canBeStunned(target)) return;
  const wasStunned = target.stun > 0;
  if (n > target.stun) target.stun = n;
  if (log) log.push({ t:'applyStun', who: uid(target), side: target.side, slot: target.slot, dur: n });
  // Opportunist reaction — only fires for newly-stunned enemies (no double-tap when a
  // bigger stun stacks over a smaller one). `ctx` carries the attacker side's team refs
  // so opportunists on that team can land a free swing on the freshly-disabled target.
  if (!wasStunned && ctx && !target.fainted) {
    triggerOpportunist(target, ctx.attackerTeam, ctx.enemyTeam, ctx.rng, log);
  }
}

// Direct-target attack — bypasses chooseTarget and the per-attack ability triggers (no
// Parental Bond, no echolocation miss, no per-attack burns/poisons). Used by Opportunist
// to land a free swing on a specific newly-stunned enemy without the side-effect cascade.
function doDirectAttack(attacker, target, attackerTeam, enemyTeam, rng, log) {
  if (attacker.fainted || attacker.stun > 0 || attacker.skipTurns > 0 || target.fainted) return;
  const { dmg, crit, tmult } = calcDamage(attacker, target, rng);
  log.push({
    t:'atk', a: uid(attacker), tgt: uid(target),
    aSide: attacker.side, aSlot: attacker.slot,
    tSide: target.side, tSlot: target.slot,
    aName: attacker.name, tName: target.name,
  });
  dealDamage(attacker, target, dmg, attackerTeam, enemyTeam, rng, log, { triggerOnHit: true, crit, tmult });
}

// ─── Combat: one attacker resolves ───────────────────────────────────────
function doAttack(attacker, attackerTeam, enemyTeam, rng, log) {
  if (attacker.fainted || attacker.stun > 0 || attacker.skipTurns > 0) return;
  const target = chooseTarget(attacker, enemyTeam, rng);
  if (!target) return;
  // Parental Bond — Kangaskhan hits twice at 60%
  const hits = (attacker.abilityId === 'parentalBond') ? 2 : 1;
  if (hits === 2 && !attacker.flagged.bondShouted) { shout(attacker, '2× 60%', log); attacker.flagged.bondShouted = true; }
  for (let i = 0; i < hits; i++) {
    if (target.fainted) break;
    // Echolocation miss check — the attacker's accuracy was lowered by a Zubat/Golbat,
    // and the roll succeeded; the attack misses entirely. Fires before target-side dodges
    // because this is the attacker's own accuracy failing, not the target evading.
    if (attacker.flagged.echoMissChance && rng.roll(attacker.flagged.echoMissChance)) {
      log.push({ t:'dodge', who: uid(attacker), side: attacker.side, slot: attacker.slot });
      continue;
    }
    // Dodge check (per hit). Sand Veil = chance to dodge; Phase = chance to dodge.
    if (target.stun === 0) {
      if (target.abilityId === 'sandVeil' && rng.roll([20, 40][target.species.stage - 1])) {
        shout(target, 'Dodge!', log);
        log.push({ t:'dodge', who: uid(target), side: target.side, slot: target.slot });
        continue;
      }
      // (Phase is replaced by Hex — Gastly line is now offensive, handled below.)
    }
    let { dmg, crit, tmult } = calcDamage(attacker, target, rng);
    if (hits === 2) dmg = Math.max(1, Math.floor(dmg * 0.6));
    // Spiral Shell (Omanyte line) — consume a stored charge for bonus damage.
    if (attacker.abilityId === 'spiralShell' && attacker.flagged.spiralCharged) {
      const pct = [20, 40][attacker.species.stage - 1];
      dmg = Math.max(1, Math.floor(dmg * (1 + pct / 100)));
      attacker.flagged.spiralCharged = false;
      shout(target, `+${pct}% DMG`, log);
    }
    // Guillotine (Krabby line) — chance to instantly KO a low-HP target. Fires before
    // the hit is dealt so the override damage = target's full remaining HP.
    if (attacker.abilityId === 'guillotine'
        && target.hp / target.hpMax < 0.5
        && rng.roll([20, 40][attacker.species.stage - 1])) {
      dmg = target.hp;
      shout(target, 'KO!', log);
    }
    // Hex (Gastly line) — bonus damage against any statused target. Stacks multiplicatively
    // with the other dmg modifiers since they already settled inside calcDamage.
    if (attacker.abilityId === 'hex'
        && (target.burn > 0 || target.poison > 0 || target.stun > 0)) {
      const bonus = [30, 50, 70][attacker.species.stage - 1];
      dmg = Math.max(1, Math.floor(dmg * (1 + bonus / 100)));
      shout(target, `+${bonus}% DMG`, log);
    }
    log.push({ t:'atk', a: uid(attacker), tgt: uid(target),
               aSide: attacker.side, aSlot: attacker.slot,
               tSide: target.side, tSlot: target.slot,
               aName: attacker.name, tName: target.name });
    dealDamage(attacker, target, dmg, attackerTeam, enemyTeam, rng, log, { triggerOnHit: true, crit, tmult });

    // Trample splash (Tauros) — 30% of the hit lands on the back-row enemy in the same column.
    if (attacker.abilityId === 'trample' && isFront(target.slot)) {
      const col = colOf(target.slot);
      const back = enemyTeam.byPos[COL_BACK[col]];
      if (back && !back.fainted) {
        shout(attacker, 'Hit back row', log);
        const splash = Math.max(1, Math.floor(dmg * 0.3));
        dealDamage(attacker, back, splash, attackerTeam, enemyTeam, rng, log, { triggerOnHit: false });
      }
    }
    // Discharge (Electabuzz) — 20% splash to other enemies in same row.
    if (attacker.abilityId === 'discharge') {
      const row = isFront(target.slot) ? FRONT : BACK;
      let any = false;
      for (const s of row) {
        const e = enemyTeam.byPos[s];
        if (e && e !== target && !e.fainted) {
          if (!any) { shout(attacker, 'Hit row', log); any = true; }
          dealDamage(attacker, e, Math.max(1, Math.floor(dmg * 0.20)), attackerTeam, enemyTeam, rng, log, { triggerOnHit: false });
        }
      }
    }
    // Mega Drain — heal 25/40% damage
    if (attacker.abilityId === 'megaDrain') {
      const amt = Math.floor(dmg * (attacker.species.stage === 2 ? 0.40 : 0.25));
      const healed = heal(attacker, amt, log, false, attacker);
      if (healed > 0) {
        shout(attacker, `Drain +${healed} HP`, log);
        triggerSunbeam(attacker, enemyTeam, rng, log);
      }
    }

    // Ability OnAttack — apply burn/poison/etc. The whole block is wrapped in an
    // encore-aware loop so a Mr.Mime/encore ally in the same column re-fires each of
    // these effects one extra time per attack (burn 4 lands as burn 8, sniper rolls
    // its extra hit twice, coil stacks +ATK twice, etc.).
    const attackEncoreReps = 1 + mimicBoost(attacker, attackerTeam);
    for (let r = 0; r < attackEncoreReps; r++) {
      if (attacker.abilityId === 'blaze' && !attacker.stun) {
        const amt = [4,8,12][attacker.species.stage - 1];
        shout(attacker, `Burn ${amt}`, log);
        applyBurn(target, amt, log);
      }
      if (attacker.abilityId === 'poisonPoint' && !attacker.stun && attacker.species.id <= 15) {
        const amt = [2,3,5][attacker.species.stage - 1];
        shout(attacker, `Poison ${amt}`, log);
        applyPoison(target, amt, log);
      }
      // Static (Pikachu line) — chance to stun the TARGET on attack (was defensive).
      if (attacker.abilityId === 'static' && !attacker.stun
          && rng.roll([30, 50][attacker.species.stage - 1])) {
        shout(target, 'Stun 1', log);
        applyStun(target, 1, log, { attackerTeam, enemyTeam, rng });
      }
      if (attacker.abilityId === 'coil') {
        const pct = [5, 10][attacker.species.stage - 1];
        shout(attacker, `ATK +${pct}%`, log);
        attacker.statMods.atk *= 1 + pct / 100;
      }
      if (attacker.abilityId === 'constrict') {
        shout(target, 'SPD -50%', log);
        target.statMods.spd *= 0.50;
      }
      if (attacker.abilityId === 'viceGrip') {
        shout(target, 'ATK -15%', log);
        target.statMods.atk *= 0.85;
      }
      if (attacker.abilityId === 'sniper' && rng.roll(attacker.species.stage === 2 ? 20 : 10)) {
        const mult = attacker.species.stage === 2 ? 4 : 3;
        shout(attacker, `+${mult}× DMG`, log);
        const extra = Math.max(1, Math.floor(dmg));
        dealDamage(attacker, target, extra, attackerTeam, enemyTeam, rng, log, { triggerOnHit: false });
      }
    }
  }
}

function dealDamage(attacker, target, dmg, atkTeam, defTeam, rng, log, opts = {}) {
  if (target.fainted) return;
  // Every damage tick that runs through dealDamage emits a 'hit' so the UI can show a popup.
  // `from` credits the attacker for the in-battle damage counter UI (regardless of source
  // tag: direct attack, splash, sniper bonus, aftermath reflect, explosion, etc.).
  if (!opts.silent && log) {
    log.push({ t:'hit', who: uid(target), side: target.side, slot: target.slot,
               dmg, crit: !!opts.crit, tmult: opts.tmult || 1,
               source: opts.source || 'attack', from: attacker ? uid(attacker) : null });
  }
  target.hp -= dmg;

  // Spiral Shell (Omanyte line) — getting hit charges the shell so the next outgoing
  // attack deals bonus damage. The bonus is consumed inside doAttack (see there).
  // `opts.reflected` filters out the recursive call from Rocky Helmet so a reflect
  // damage tick doesn't itself charge the shell of the unit doing the reflecting.
  if (target.abilityId === 'spiralShell' && target.hp > 0 && !opts.reflected) {
    target.flagged.spiralCharged = true;
  }
  // Shell Bash (Squirtle line) — getting hit permanently hardens the shell, granting
  // a stacking damage reduction (capped at 50%). The reduction applies in calcDamage
  // to subsequent hits, not this one — so each new stack pays off starting next attack.
  if (target.abilityId === 'shellBash' && target.hp > 0 && !opts.reflected) {
    const pct = [3, 5, 8][target.species.stage - 1];
    const cur = target.flagged.shellBashDR || 0;
    if (cur < 50) {
      target.flagged.shellBashDR = Math.min(50, cur + pct);
      shout(target, `DEF ${target.flagged.shellBashDR}%`, log);
    }
  }

  // OnHit abilities
  if (opts.triggerOnHit && target.stun === 0 && !target.fainted) {
    // Rocky Helmet (Geodude line) — reflect % (Magic Guard immune to non-direct damage)
    if (target.abilityId === 'rockyHelmet' && !opts.reflected && attacker.abilityId !== 'magicGuard') {
      const r = [0.15, 0.30, 0.45][target.species.stage - 1];
      const refl = Math.max(1, Math.floor(dmg * r));
      // Shout on the attacker — they're the one taking the retaliation damage.
      shout(attacker, `Return ${refl} DMG`, log);
      dealDamage(target, attacker, refl, defTeam, atkTeam, rng, log, { reflected: true, triggerOnHit: false });
    }
    // (Static is now an OFFENSIVE ability — handled in doAttack, not here.)
    if (target.abilityId === 'effectSpore' && rng.roll([25, 50][target.species.stage - 1])) {
      // Stun-only effect (no longer rolls between stun/poison). The target's effectSpore
      // stuns the attacker, so opportunists belong to the defending team (which owns the
      // effectSpore Pokémon) — pass that as `attackerTeam` in the opportunist context.
      const dur = target.species.stage;
      shout(attacker, `Stun ${dur}`, log);
      applyStun(attacker, dur, log, { attackerTeam: defTeam, enemyTeam: atkTeam, rng });
    }
    if (target.abilityId === 'flameBody') {
      shout(attacker, 'Burn 3', log);
      applyBurn(attacker, 3, log);
    }
    if (target.abilityId === 'toxicSpike') {
      // Always triggers — no chance gate. Poison stacks at 2 (Horsea) / 4 (Seadra).
      const amt = [2, 4][target.species.stage - 1];
      shout(attacker, `Poison ${amt}`, log);
      applyPoison(attacker, amt, log);
    }
  }

  // Rest trigger
  if (target.abilityId === 'rest' && !target.restUsed && target.hp > 0 && target.hp / target.hpMax < 0.5 && target.stun === 0) {
    shout(target, 'Full HP, Sleep 3', log);
    target.hp = target.hpMax;
    target.stun = 3;
    target.restUsed = true;
    log.push({ t:'rest', who: uid(target), side: target.side, slot: target.slot, name: target.name });
  }
  // (runAway retired — Rattata line now uses `opportunist`, handled in applyStun.)

  // OnAllyHit triggers (Stamina, Rivalry)
  if (opts.triggerOnHit) {
    for (const u of defTeam.units) {
      if (u.fainted || u === target || u.stun > 0) continue;
      if (u.abilityId === 'stamina') {
        const bonus = Math.max(1, Math.floor(u.hpMax * [0.02, 0.04, 0.05][u.species.stage - 1]));
        shout(u, `+${bonus} HP`, log);
        heal(u, bonus, log, true, u);
      }
      if (u.abilityId === 'rivalry') {
        const pct = [2, 4, 5][u.species.stage - 1];
        shout(u, `ATK +${pct}%`, log);
        u.statMods.atk *= 1 + pct / 100;
      }
    }
    // Stamina/Rivalry on self
    if (target.abilityId === 'stamina' && target.stun === 0) {
      const bonus = Math.max(1, Math.floor(target.hpMax * [0.02, 0.04, 0.05][target.species.stage - 1]));
      shout(target, `+${bonus} HP`, log);
      heal(target, bonus, log, true, target);
    }
    if (target.abilityId === 'rivalry' && target.stun === 0) {
      const pct = [2, 4, 5][target.species.stage - 1];
      shout(target, `ATK +${pct}%`, log);
      target.statMods.atk *= 1 + pct / 100;
    }
  }

  // Check faint
  if (target.hp <= 0) {
    target.hp = 0;
    target.fainted = true;
    log.push({ t:'faint', who: uid(target), side: target.side, slot: target.slot, name: target.name });
    onFaint(target, attacker, atkTeam, defTeam, rng, log);
  }
}

// `rng` is needed for Aftermath's retaliation damage roll (and any future on-faint effect
// that needs randomness). It was previously missing from the parameter list, which crashed
// the battle the first time a Koffing/Weezing fainted.
function onFaint(victim, killer, killerTeam, victimTeam, rng, log) {
  // Moxie — killer gains ATK
  if (killer && killer.abilityId === 'moxie' && !killer.fainted && killer.stun === 0) {
    const pct = [15, 30][killer.species.stage - 1];
    shout(killer, `ATK +${pct}%`, log);
    killer.statMods.atk *= 1 + pct / 100;
  }
  // Aftermath — victim retaliates (Magic Guard blocks non-direct damage)
  if (victim.abilityId === 'aftermath' && killer && !killer.fainted && killer.abilityId !== 'magicGuard') {
    const dmg = Math.floor(victim.hpMax * [0.30, 0.50][victim.species.stage - 1]);
    // Shout on the killer — they're the one taking the retaliation damage.
    shout(killer, `Return ${dmg} DMG`, log);
    dealDamage(victim, killer, dmg, victimTeam, killerTeam, rng, log, { triggerOnHit: false, crit: true, source: 'aftermath' });
  }
  // Shed Skin — first faint, revive
  if (victim.abilityId === 'shedSkin' && !victim.flagged.shedUsed) {
    victim.flagged.shedUsed = true;
    victim.fainted = false;
    victim.hp = Math.floor(victim.hpMax * [0.25, 0.40, 0.55][victim.species.stage - 1]);
    shout(victim, `Revive ${victim.hp} HP`, log);
    log.push({ t:'revive', who: uid(victim), side: victim.side, slot: victim.slot, name: victim.name, hp: victim.hp });
    return;
  }
  // (gluttony retired — Bellsprout line now uses `photosynthesis`, which fires on any
  // allied ability trigger rather than on enemy faint. Handled in pingPhotosynthesis.)

  // Anger Point (Mankey line) — when an ally faints, surviving teammates get an ATK buff.
  // Runs AFTER the shedSkin revive check so it only counts permanent faints, not revivals.
  for (const u of victimTeam.units) {
    if (u.fainted || u.stun > 0 || u === victim) continue;
    if (u.abilityId === 'angerPoint') {
      const pct = [15, 30][u.species.stage - 1];
      shout(u, `ATK +${pct}%`, log);
      u.statMods.atk *= 1 + pct / 100;
    }
  }
}

// ─── Battle-start abilities ───────────────────────────────────────────────
function onBattleStart(teamA, teamB, rng, log) {
  // Cross-team setup: attach team back-references for damage calc
  for (const u of teamA.units) u.team = teamA;
  for (const u of teamB.units) u.team = teamB;

  // Jynx Disrupt: priority. If any Jynx alive on either side, fire its effect FIRST then suppress all other onBattleStart.
  const jynx = [...teamA.units, ...teamB.units].find(u => u.abilityId === 'disrupt');
  const battleStartDisabled = !!jynx;

  if (battleStartDisabled) { shout(jynx, 'Block abilities', log); log.push({ t:'disrupt' }); }

  // Damp pre-pass — disables the abilities of the enemy directly across from each Psyduck
  // (and the back-row of that column for Golduck). Runs BEFORE fireForTeam so the target's
  // own onBattleStart ability doesn't fire before being silenced. Setting `abilityId = null`
  // makes every subsequent `u.abilityId === '…'` check in the engine naturally short-circuit,
  // which covers offensive, defensive, turn-start, turn-end, and onFaint triggers in one
  // stroke without having to gate every ability site individually. Disrupt blocks Damp too —
  // it's also a battle-start ability, subject to Jynx's lockout.
  const dampPass = (own, enemy) => {
    if (battleStartDisabled) return;
    for (const u of own.units) {
      if (u.fainted || u.abilityId !== 'damp') continue;
      const col = colOf(u.slot);
      const f = enemy.byPos[COL_FRONT[col]];
      const b = enemy.byPos[COL_BACK[col]];
      if (f && !f.fainted && f.abilityId) { shout(f, 'Ability blocked', log); f.abilityId = null; }
      if (u.species.stage === 2 && b && !b.fainted && b.abilityId) { shout(b, 'Ability blocked', log); b.abilityId = null; }
    }
  };
  dampPass(teamA, teamB);
  dampPass(teamB, teamA);

  const fireForTeam = (team, enemy) => {
    // Each unit's battle-start ability runs through runAbility, which returns true if a
    // case body actually executed. After a real trigger we ping photosynthesis (Bellsprout
    // line heals on any allied trigger). If a Mr.Mime/encore sits in the same column, we
    // repeat the run+ping once more — that's the synergy hook.
    const runAbility = (u) => {
      switch (u.abilityId) {
        case 'intimidate': {
          const stage = u.species.stage || 1;
          const pct = [0.05, 0.50][stage - 1];
          const col = colOf(u.slot);
          const target = enemy.byPos[COL_FRONT[col]];
          if (target && !target.fainted) {
            shout(target, `ATK -${Math.round(pct * 100)}%`, log);
            target.statMods.atk *= 1 - pct;
          }
          return true;
        }
        case 'arenaTrap': {
          const stage = u.species.stage || 1;
          const pct = [0.20, 0.40][stage - 1];
          for (const slot of BACK) {
            const t = enemy.byPos[slot];
            if (t && !t.fainted) {
              shout(t, `SPD -${Math.round(pct * 100)}%`, log);
              t.statMods.spd *= 1 - pct;
            }
          }
          return true;
        }
        case 'lullaby': {
          const stage = u.species.stage || 1;
          const alive = enemy.units.filter(x => !x.fainted);
          if (alive.length) {
            const dur = [2, 4][stage - 1];
            const t = rng.pick(alive);
            shout(t, `Stun ${dur}`, log);
            applyStun(t, dur, log, { attackerTeam: team, enemyTeam: enemy, rng });
          }
          return true;
        }
        case 'cloudNine': {
          // Hits BOTH enemies in the opposing column for Stun 2 — front and back. Each
          // applyStun is independent, so Opportunist allies fire once per landed stun.
          const col = colOf(u.slot);
          for (const slot of [COL_FRONT[col], COL_BACK[col]]) {
            const t = enemy.byPos[slot];
            if (t && !t.fainted) {
              shout(t, 'Stun 2', log);
              applyStun(t, 2, log, { attackerTeam: team, enemyTeam: enemy, rng });
            }
          }
          return true;
        }
        case 'imposter': {
          const col = colOf(u.slot);
          const myRow = isFront(u.slot) ? 'F' : 'B';
          const leftSlot = myRow + (col - 1);
          if (col > 1) {
            const ally = team.byPos[leftSlot];
            if (ally && !ally.fainted && ally !== u) {
              shout(u, 'Copy ally', log);
              u.species = ally.species; u.name = ally.name;
              u.type1 = ally.type1; u.type2 = ally.type2;
              u.hpMax = ally.hpMax; u.hp = ally.hp;
              u.atk = ally.atk; u.spd = ally.spd;
              u.abilityId = ally.abilityId;
              // Emit a log event so the animation can swap Ditto's sprite to the copied
              // ally's species and overlay the purple "imposter" tint.
              log.push({
                t: 'imposter', who: uid(u), side: u.side, slot: u.slot,
                copiedSpeciesId: ally.species.id, copiedName: ally.name,
              });
            }
          }
          return true;
        }
        case 'helpingHand': {
          const stage = u.species.stage || 1;
          const pct = [0.20, 0.40][stage - 1];
          const col = colOf(u.slot);
          const myRow = isFront(u.slot) ? 'F' : 'B';
          const pctLabel = `HP +${Math.round(pct * 100)}%`;
          shout(u, pctLabel, log);
          const selfBonus = Math.floor(u.hpMax * pct);
          u.hpMax += selfBonus; u.hp += selfBonus;
          for (const dc of [-1, +1]) {
            const c = col + dc;
            if (c < 1 || c > 3) continue;
            const ally = team.byPos[myRow + c];
            if (ally && !ally.fainted && ally !== u) {
              shout(ally, pctLabel, log);
              const bonus = Math.floor(ally.hpMax * pct);
              ally.hpMax += bonus; ally.hp += bonus;
            }
          }
          return true;
        }
        case 'predatorsMark': {
          const stage = u.species.stage || 1;
          const cutPct = [5, 10][stage - 1];
          for (const e of enemy.units) {
            if (e.fainted) continue;
            shout(e, `HP -${cutPct}%`, log);
            const lost = Math.floor(e.hpMax * cutPct / 100);
            e.hpMax -= lost; e.hp = Math.max(1, e.hp - lost);
          }
          return true;
        }
        case 'skyHigh': shout(u, 'Sky High', log); return true; // dynamic untargetability — see chooseTarget
        case 'magnetPull': {
          const stage = u.species.stage || 1;
          const cols = [1,2,3].sort(() => rng.float() - 0.5).slice(0, stage);
          for (const c of cols) {
            const front = enemy.byPos[COL_FRONT[c]];
            const back  = enemy.byPos[COL_BACK[c]];
            if (front && back) {
              shout(front, 'Swapped', log);
              shout(back,  'Swapped', log);
              enemy.byPos[COL_FRONT[c]] = back;  back.slot  = COL_FRONT[c];
              enemy.byPos[COL_BACK[c]]  = front; front.slot = COL_BACK[c];
              log.push({
                t:'swap', side: front.side,
                a: uid(front), aFrom: COL_FRONT[c], aTo: COL_BACK[c],
                b: uid(back),  bFrom: COL_BACK[c],  bTo: COL_FRONT[c],
              });
            }
          }
          return true;
        }
        case 'explosion': {
          // Porygon is single-stage. Self-KO at battle start, taking out the enemy in
          // the SAME row + same column as Porygon — i.e. if Porygon's in F2, kill enemy
          // F2; if Porygon's in B2, kill enemy B2. Mirrors Porygon's own position.
          const col = colOf(u.slot);
          const targetSlot = isFront(u.slot) ? COL_FRONT[col] : COL_BACK[col];
          shout(u, 'Self-KO', log);
          log.push({ t:'explode', who: uid(u), side: u.side, slot: u.slot });
          const t = enemy.byPos[targetSlot];
          if (t && !t.fainted) {
            dealDamage(u, t, t.hp, team, enemy, rng, log, { triggerOnHit: false, crit: true, source: 'explosion' });
          }
          u.fainted = true; u.hp = 0;
          log.push({ t:'faint', who: uid(u), side: u.side, slot: u.slot, name: u.name, cause: 'self' });
          return true;
        }
        case 'boulderRoll': {
          // Rhyhorn (stage 1) — slam the opposing front-column enemy for 50% of one
          // normal attack's worth of damage at battle start. Rhydon (stage 2) — 100%.
          const col = colOf(u.slot);
          const target = enemy.byPos[COL_FRONT[col]] || enemy.byPos[COL_BACK[col]];
          if (target && !target.fainted) {
            shout(u, 'Charge!', log);
            const pct = [0.50, 1.00][u.species.stage - 1] || 0.50;
            const { dmg, crit, tmult } = calcDamage(u, target, rng);
            const scaled = Math.max(1, Math.floor(dmg * pct));
            log.push({
              t:'atk', a: uid(u), tgt: uid(target),
              aSide: u.side, aSlot: u.slot,
              tSide: target.side, tSlot: target.slot,
              aName: u.name, tName: target.name,
            });
            dealDamage(u, target, scaled, team, enemy, rng, log, { triggerOnHit: false, crit, tmult, source: 'boulderRoll' });
          }
          return true;
        }
      }
      return false;
    };
    // Helper: fire a unit's current ability once, respecting Mr.Mime/encore reps
    // and photosynthesis pings. Centralized so both passes call the same logic.
    const fireUnit = (u) => {
      const repeats = 1 + mimicBoost(u, team);
      for (let r = 0; r < repeats; r++) {
        const triggered = runAbility(u);
        if (triggered) pingPhotosynthesis(u, team, enemy, rng, log);
      }
    };
    // Pass 1: imposters fire FIRST so they can copy the original ally before that
    // ally's own battle-start ability fires (matters for one-shot triggers like
    // Snorlax's body-slam stack init, etc.). Once Ditto copies, its abilityId is
    // overwritten with the copied ability — if that ability is also a battle-start
    // trigger (Magnet Pull, Cloud Nine, Intimidate, Helping Hand, etc.), Ditto
    // fires it immediately so the player sees the copied effect, not just the
    // copied sprite. A flag is set so Pass 2 skips it (otherwise the now-copied
    // ability would fire a second time).
    for (const u of team.units) {
      if (u.fainted) continue;
      if (u.abilityId !== 'imposter') continue;
      if (battleStartDisabled) continue;        // Jynx/Disrupt blocks imposter too
      u._imposterFired = true;                  // mark before any mutation
      fireUnit(u);                              // fires imposter → copies ally → u.abilityId = ally's
      // If the copy yielded a non-imposter battle-start ability, fire that too.
      // (Skip if copy failed and u.abilityId is still 'imposter'.)
      if (u.abilityId && u.abilityId !== 'imposter') {
        fireUnit(u);
      }
    }
    // Pass 2: every non-imposter unit, plus any imposter that never fired Pass 1
    // (battle-start disabled by Disrupt, or already fainted).
    for (const u of team.units) {
      if (u.fainted) continue;
      if (battleStartDisabled && u.abilityId !== 'disrupt') continue;
      if (u._imposterFired) continue;           // already handled in Pass 1
      fireUnit(u);
    }
  };
  fireForTeam(teamA, teamB);
  fireForTeam(teamB, teamA);

  // Rock Head — clear statuses on self (already 0 at start, but cement)
  // Drought / similar buffing removed for compactness.
}

// ─── End-of-turn triggers ────────────────────────────────────────────────
function onTurnEnd(team, enemyTeam, rng, log, turnNumber) {
  // Status damage first. Magic Guard skips the damage tick but the counter still decays.
  for (const u of team.units) {
    if (u.fainted) continue;
    if (u.burn > 0) {
      const baseDmg = Math.max(0, u.burn - 1);
      const dmg = (u.abilityId === 'magicGuard') ? 0 : baseDmg;
      u.hp -= dmg;
      u.burn = Math.max(0, u.burn - 1);
      // Always log — `remaining` lets the animation tick the on-screen badge down even
      // when there's no damage to show (e.g. burn 1 decaying to 0, or Magic Guard absorbing).
      log.push({ t:'burn', who: uid(u), dmg, remaining: u.burn, side: u.side, slot: u.slot });
      if (u.hp <= 0) { u.fainted = true; u.hp = 0; log.push({ t:'faint', who: uid(u), side: u.side, slot: u.slot, cause: 'burn' }); }
    }
    if (u.poison > 0 && !u.fainted) {
      // Poison Y ticks Y% max HP per turn (min 1 so the effect is always visible).
      // Unlike Burn, Poison does NOT decay — the stack value persists for the rest of
      // the battle, so each turn deals a fixed % of max HP until the target faints.
      const baseDmg = Math.max(1, Math.floor(u.hpMax * u.poison / 100));
      const dmg = (u.abilityId === 'magicGuard') ? 0 : baseDmg;
      u.hp -= dmg;
      log.push({ t:'poison', who: uid(u), dmg, remaining: u.poison, side: u.side, slot: u.slot });
      if (u.hp <= 0) { u.fainted = true; u.hp = 0; log.push({ t:'faint', who: uid(u), side: u.side, slot: u.slot, cause: 'poison' }); }
    }
    if (u.stun > 0) {
      u.stun--;
      // Stun decay isn't a damage event but the animation needs to know about it so the
      // on-screen "Nx S" badge can tick down each turn.
      log.push({ t:'stunTick', who: uid(u), remaining: u.stun });
    }
    if (u.skipTurns > 0) u.skipTurns--;
    if (u.untargetable > 0) u.untargetable--;
  }

  // OnTurnEnd ability triggers (skip if stunned). Each unit's case body runs once, then
  // we ping photosynthesis. If a Mr.Mime (encore) is in the same column, the whole cycle
  // repeats one extra time.
  const runTurnEnd = (u) => {
    switch (u.abilityId) {
      case 'overgrowth': {
        const amt = Math.floor(u.hpMax * [0.10, 0.20, 0.30][u.species.stage - 1]);
        const healed = heal(u, amt, log, false, u);
        if (healed > 0) {
          shout(u, `+${healed} HP`, log);
          triggerSunbeam(u, enemyTeam, rng, log);
        }
        return true;
      }
      case 'healer': {
        const col = colOf(u.slot);
        const row = isFront(u.slot) ? 'F' : 'B';
        const pct = [0.08, 0.15][u.species.stage - 1];
        const targets = [u];
        for (const dc of [-1, +1]) {
          if (col + dc < 1 || col + dc > 3) continue;
          const a = team.byPos[row + (col + dc)];
          if (a && !a.fainted) targets.push(a);
        }
        for (const a of targets) {
          const healed = heal(a, Math.floor(a.hpMax * pct), log, false, u);
          if (healed > 0) {
            shout(a, `+${healed} HP`, log);
            triggerSunbeam(a, enemyTeam, rng, log);
          }
        }
        return true;
      }
      case 'tailwind': {
        const col = colOf(u.slot);
        const row = isFront(u.slot) ? 'F' : 'B';
        const buff = [0.03, 0.06, 0.10][u.species.stage - 1];
        for (const dc of [-1, +1]) {
          if (col + dc < 1 || col + dc > 3) continue;
          const a = team.byPos[row + (col + dc)];
          if (a && !a.fainted) {
            shout(a, `ATK +${Math.round(buff * 100)}%`, log);
            a.statMods.atk *= 1 + buff;
          }
        }
        return true;
      }
      case 'chlorophyll': {
        const pct = [5, 8, 12][u.species.stage - 1];
        shout(u, `ATK +${pct}%`, log);
        u.statMods.atk *= 1 + pct / 100;
        return true;
      }
      case 'naturalCure': {
        const col = colOf(u.slot);
        const row = isFront(u.slot) ? 'F' : 'B';
        const candidates = [u];
        for (const dc of [-1, +1]) {
          if (col + dc < 1 || col + dc > 3) continue;
          const a = team.byPos[row + (col + dc)];
          if (a) candidates.push(a);
        }
        for (const t of candidates) {
          if (!t.fainted && (t.stun > 0 || t.burn > 0 || t.poison > 0)) {
            shout(t, 'Cure status', log);
            t.stun = 0; t.burn = 0; t.poison = 0;
          }
        }
        return true;
      }
      case 'yawn': {
        const stage = u.species.stage || 1;
        const trigger = stage === 1 ? 5 : 4;
        if (turnNumber === trigger && !u.flagged.yawnFired) {
          u.flagged.yawnFired = true;
          shout(u, 'KO target', log);
          const alive = enemyTeam.units.filter(x => !x.fainted);
          if (alive.length) {
            const t = rng.pick(alive);
            dealDamage(u, t, t.hp, team, enemyTeam, rng, log, { triggerOnHit: false, crit: true, source: 'yawn' });
          }
          return true;
        }
        return false;
      }
      // (solarBeam retired — Exeggcute line now uses `sunbeam`, a heal-listener ability.)
      case 'whaleSong': {
        if (turnNumber === 3 && !u.flagged.songFired) {
          u.flagged.songFired = true;
          for (const a of team.units) {
            if (a.fainted) continue;
            const amt = Math.floor(a.hpMax * 0.50);
            const healed = heal(a, amt, log, false, u);
            if (healed > 0) {
              shout(a, `+${healed} HP`, log);
              triggerSunbeam(a, enemyTeam, rng, log);
            }
          }
          return true;
        }
        return false;
      }
      case 'toxicSweat': {
        const alive = enemyTeam.units.filter(x => !x.fainted);
        if (alive.length) {
          const amt = [3, 5][u.species.stage - 1];
          const t = rng.pick(alive);
          shout(t, `Poison ${amt}`, log);
          applyPoison(t, amt, log);
        }
        return true;
      }
    }
    return false;
  };
  for (const u of team.units) {
    if (u.fainted || u.stun > 0) continue;
    const repeats = 1 + mimicBoost(u, team);
    for (let r = 0; r < repeats; r++) {
      const triggered = runTurnEnd(u);
      if (triggered) pingPhotosynthesis(u, team, enemyTeam, rng, log);
    }
  }
}

// ─── Turn-start triggers ────────────────────────────────────────────────
function onTurnStart(team, enemyTeam, rng, log, turnNumber) {
  // Same pattern as onTurnEnd: runTurnStart returns true if a case fired, then we ping
  // photosynthesis and optionally repeat for Mr.Mime/encore in the same column.
  const runTurnStart = (u) => {
    let triggered = false;
    if (u.abilityId === 'echolocation') {
      const pct = [2, 4][u.species.stage - 1];
      for (const e of enemyTeam.units) {
        if (e.fainted) continue;
        e.flagged.echoMissChance = (e.flagged.echoMissChance || 0) + pct;
        shout(e, `Miss +${pct}%`, log);
      }
      triggered = true;
    }
    if (u.abilityId === 'hypnosis' && turnNumber % 2 === 1) {
      const alive = enemyTeam.units.filter(x => !x.fainted);
      if (alive.length) {
        const dur = [1, 2][u.species.stage - 1];
        const t = rng.pick(alive);
        shout(t, `Stun ${dur}`, log);
        applyStun(t, dur, log, { attackerTeam: team, enemyTeam, rng });
      }
      triggered = true;
    }
    if (u.abilityId === 'willOWisp') {
      const backAlive = enemyTeam.units.filter(x => !x.fainted && !isFront(x.slot));
      if (backAlive.length) {
        const amt = [4, 7][u.species.stage - 1];
        const t = rng.pick(backAlive);
        shout(t, `Burn ${amt}`, log);
        applyBurn(t, amt, log);
      }
      triggered = true;
    }
    return triggered;
  };
  for (const u of team.units) {
    if (u.fainted || u.stun > 0) continue;
    const repeats = 1 + mimicBoost(u, team);
    for (let r = 0; r < repeats; r++) {
      const triggered = runTurnStart(u);
      if (triggered) pingPhotosynthesis(u, team, enemyTeam, rng, log);
    }
  }
}

// ─── Battle loop ────────────────────────────────────────────────────────
export function simulate(teamA, teamB, seed) {
  const rng = newRng(seed);
  const log = [];
  onBattleStart(teamA, teamB, rng, log);

  const aliveAny = (t) => t.units.some(u => !u.fainted);

  for (let turn = 1; turn <= 50; turn++) {
    if (!aliveAny(teamA)) return { winner: 'B', turns: turn, log };
    if (!aliveAny(teamB)) return { winner: 'A', turns: turn, log };

    log.push({ t: 'turnStart', turn });
    onTurnStart(teamA, teamB, rng, log, turn);
    onTurnStart(teamB, teamA, rng, log, turn);

    // Order: Early Bird actors first (randomized among themselves), then SPD desc.
    const all = [...teamA.units, ...teamB.units].filter(u => !u.fainted);
    const earlyBirds = all.filter(u => u.abilityId === 'earlyBird');
    const others = all.filter(u => u.abilityId !== 'earlyBird');
    earlyBirds.sort(() => rng.float() - 0.5);
    others.sort((a, b) => (b.spd * b.statMods.spd) - (a.spd * a.statMods.spd) || rng.float() - 0.5);
    const order = [...earlyBirds, ...others];

    for (const actor of order) {
      if (actor.fainted) continue;
      if (actor.stun > 0) continue;       // stun consumed at turn end
      if (actor.skipTurns > 0) continue;  // Sky High
      const enemyTeam = actor.side === 'A' ? teamB : teamA;
      const ownTeam   = actor.side === 'A' ? teamA : teamB;
      doAttack(actor, ownTeam, enemyTeam, rng, log);
      if (!aliveAny(teamA) || !aliveAny(teamB)) break;
    }

    onTurnEnd(teamA, teamB, rng, log, turn);
    onTurnEnd(teamB, teamA, rng, log, turn);
  }
  // Stalemate after 50 turns: side with more total HP wins
  const hpA = teamA.units.reduce((s, u) => s + u.hp, 0);
  const hpB = teamB.units.reduce((s, u) => s + u.hp, 0);
  return { winner: hpA > hpB ? 'A' : hpB > hpA ? 'B' : 'draw', turns: 50, log };
}
