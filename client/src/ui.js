// UI helpers: rendering HUD, tooltips, drag-and-drop, sprite URLs.
import { SPECIES, ITEMS, BERRIES, ZONES, rankFromElo } from './data.js';
import { t } from './i18n.js';

export const SPRITE_URL = (id) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
export const ITEM_ICON_URL = (slug) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${slug}.png`;
// Trainer sprites come from Pokémon Showdown's CDN — it has a complete Gen 1 roster
// with consistent naming. PokeAPI's trainers folder is patchy by comparison.
export const TRAINER_SPRITE_URL = (slug) => `https://play.pokemonshowdown.com/sprites/trainers/${slug}.png`;

// Mapping from our internal item / berry / rank ids to PokeAPI sprite slugs.
const ITEM_SLUG = {
  tradeCard: 'up-grade',
  revive:    'revive',
  xVitamin:  'x-attack',
  greatBall: 'great-ball',
  evosoda:   'rare-candy',
  tm:        'tm-normal',
  hm:        'hm-normal',
  spiritPendant: 'soul-dew',
  lure:      'honey',
};
const BERRY_SLUG = {
  oran:  'oran-berry',
  cheri: 'cheri-berry',
  salac: 'salac-berry',
  // Small berries reuse the same PokéAPI sprite art; the `.berry-small` class on the
  // rendered <img> shrinks them visually so the player can distinguish at a glance.
  oranSmall:  'oran-berry',
  cheriSmall: 'cheri-berry',
  salacSmall: 'salac-berry',
};
const RANK_SLUG = {
  'Poké':   'poke-ball',
  'Great':  'great-ball',
  'Ultra':  'ultra-ball',
  'Master': 'master-ball',
};
export function itemIcon(id)  { const s = ITEM_SLUG[id] || BERRY_SLUG[id]; return s ? ITEM_ICON_URL(s) : null; }
export function rankIcon(tier){ return ITEM_ICON_URL(RANK_SLUG[tier] || 'poke-ball'); }

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Ability descriptions — RPG-style, stage-specific. Index 0 = stage 1, etc.
const ABILITY_DESC = {
  overgrowth: [
    'At the end of each turn, restores 10% of max HP.',
    'At the end of each turn, restores 20% of max HP.',
    'At the end of each turn, restores 30% of max HP.',
  ],
  blaze: [
    'Every attack burns the target for 4.',
    'Every attack burns the target for 8.',
    'Every attack burns the target for 12.',
  ],
  shellBash: [
    'Each hit taken permanently grants +3% damage reduction (caps at 50%).',
    'Each hit taken permanently grants +5% damage reduction (caps at 50%).',
    'Each hit taken permanently grants +8% damage reduction (caps at 50%).',
  ],
  static: [
    'Each attack has a 30% chance to apply Stun 1 to the target.',
    'Each attack has a 50% chance to apply Stun 1 to the target.',
  ],
  helpingHand: [
    'At the start of battle, this Pokémon and adjacent allies gain 20% max HP.',
    'At the start of battle, this Pokémon and adjacent allies gain 40% max HP.',
  ],
  // Kept for safety in case stale data references them; no longer assigned to any Pokémon.
  adaptability: ['At the start of battle, copies the ability of the ally directly to its right.'],
  waterAbsorb:  ['When hit by a Water attack, restores 25% of max HP instead of taking damage.'],
  pickup: [
    'Every battle won grants 100 extra coins.',
    'Every battle won grants 200 extra coins.',
  ],
  lullaby: [
    'At the start of battle, stuns a random enemy for 2 turns.',
    'At the start of battle, stuns a random enemy for 4 turns.',
  ],
  tailwind: [
    'At the end of each turn, horizontally adjacent allies gain 3% ATK. Stacks.',
    'At the end of each turn, horizontally adjacent allies gain 6% ATK. Stacks.',
    'At the end of each turn, horizontally adjacent allies gain 10% ATK. Stacks.',
  ],
  runAway: [
    'The first time HP drops below 30%, swaps with the ally behind and gains 20% ATK.',
    'The first time HP drops below 30%, swaps with the ally behind and gains 35% ATK.',
  ],
  sniper: [
    'Critical hits deal triple damage, and crit rate is doubled.',
    'Critical hits deal quadruple damage, and crit rate is doubled.',
  ],
  shedSkin: [
    'The first time this Pokémon faints, it revives with 25% of its max HP.',
    'The first time this Pokémon faints, it revives with 40% of its max HP.',
    'The first time this Pokémon faints, it revives with 55% of its max HP.',
  ],
  poisonPoint: [
    'Every attack inflicts Poison 2 on the target.',
    'Every attack inflicts Poison 3 on the target.',
    'Every attack inflicts Poison 5 on the target.',
  ],
  coil: [
    'Every attack permanently raises this Pokémon\'s ATK by 5%.',
    'Every attack permanently raises this Pokémon\'s ATK by 10%.',
  ],
  sandVeil: [
    'When struck, 20% chance to take no damage from the attack.',
    'When struck, 40% chance to take no damage from the attack.',
  ],
  stamina: [
    'Every time an ally is hit, this Pokémon gains 2% to its max and current HP.',
    'Every time an ally is hit, this Pokémon gains 4% to its max and current HP.',
    'Every time an ally is hit, this Pokémon gains 5% to its max and current HP.',
  ],
  rivalry: [
    'Every time an ally is hit, this Pokémon gains 2% ATK.',
    'Every time an ally is hit, this Pokémon gains 4% ATK.',
    'Every time an ally is hit, this Pokémon gains 5% ATK.',
  ],
  healer: [
    'At the end of each turn, restores 8% of max HP to itself and adjacent same-row allies.',
    'At the end of each turn, restores 15% of max HP to itself and adjacent same-row allies.',
  ],
  willOWisp: [
    'At the start of each turn, burns a random back-row enemy for 4.',
    'At the start of each turn, burns a random back-row enemy for 7.',
  ],
  echolocation: [
    'At the start of each turn, every enemy gains a stacking 2% chance to miss their attacks.',
    'At the start of each turn, every enemy gains a stacking 4% chance to miss their attacks.',
  ],
  chlorophyll: [
    'At the end of each turn, gains 5% ATK. Stacks.',
    'At the end of each turn, gains 8% ATK. Stacks.',
    'At the end of each turn, gains 12% ATK. Stacks.',
  ],
  effectSpore: [
    'When struck, 25% chance to stun the attacker for 1 turn.',
    'When struck, 50% chance to stun the attacker for 2 turns.',
  ],
  arenaTrap: [
    'At the start of battle, the enemy back row loses 20% SPD.',
    'At the start of battle, the enemy back row loses 40% SPD.',
  ],
  damp: [
    'At the start of battle, permanently disables the ability of the enemy directly across from this Pokémon.',
    'At the start of battle, permanently disables the abilities of both enemies in the opposing column.',
  ],
  vitalSpirit: [
    'Below 50% HP, attacks deal 25% more damage.',
    'Below 50% HP, attacks deal 50% more damage.',
  ],
  moxie: [
    'Each enemy this Pokémon defeats grants 15% ATK. Stacks.',
    'Each enemy this Pokémon defeats grants 30% ATK. Stacks.',
  ],
  waterVeil: [
    'At or above 75% HP, attacks deal 10% more damage.',
    'At or above 75% HP, attacks deal 20% more damage.',
    'At or above 75% HP, attacks deal 30% more damage.',
  ],
  magicGuard: [
    'Immune to all damage from sources other than direct attacks.',
    'Immune to all damage from sources other than direct attacks.',
    'Immune to all damage from sources other than direct attacks.',
  ],
  crossChop: [
    'Each attack has a 30% chance to land a critical hit.',
    'Each attack has a 45% chance to land a critical hit.',
    'Each attack has a 60% chance to land a critical hit.',
  ],
  gluttony: [
    'Whenever any enemy faints, restores 10% of max HP.',
    'Whenever any enemy faints, restores 20% of max HP.',
    'Whenever any enemy faints, restores 30% of max HP.',
  ],
  toxicSweat: [
    'At the end of each turn, poisons a random enemy for 3.',
    'At the end of each turn, poisons a random enemy for 5.',
  ],
  rockyHelmet: [
    'Reflects 15% of the damage taken back to the attacker.',
    'Reflects 30% of the damage taken back to the attacker.',
    'Reflects 45% of the damage taken back to the attacker.',
  ],
  yawn: [
    'At the end of turn 5, instantly defeats a random enemy. Once per battle.',
    'At the end of turn 4, instantly defeats a random enemy. Once per battle.',
  ],
  magnetPull: [
    'At the start of battle, swaps the front and back of 1 random enemy column.',
    'At the start of battle, swaps the front and back of 2 random enemy columns.',
  ],
  earlyBird: [
    'Always acts first every turn, regardless of Speed.',
    'Always acts first every turn, regardless of Speed.',
  ],
  rest: [
    'The first time HP drops below 50%, fully heals and sleeps for 3 turns. While asleep, this Pokémon cannot act. Once per battle.',
    'The first time HP drops below 50%, fully heals and sleeps for 3 turns. While asleep, this Pokémon cannot act. Once per battle.',
  ],
  pungentAura: [
    'All enemies are forced to attack this Pokémon first, even from the back row.',
    'All enemies are forced to attack this Pokémon first, even from the back row.',
  ],
  withdraw: [
    'Takes 15% less damage from all attacks.',
    'Takes 30% less damage from all attacks.',
  ],
  hex: [
    'Attacks deal +30% damage against an enemy suffering any status (burn, poison, or stun).',
    'Attacks deal +50% damage against an enemy suffering any status (burn, poison, or stun).',
    'Attacks deal +70% damage against an enemy suffering any status (burn, poison, or stun).',
  ],
  rockHead: [
    'Immune to all status effects.',
  ],
  hypnosis: [
    'On odd-numbered turns, stuns a random enemy for 1 turn.',
    'On odd-numbered turns, stuns a random enemy for 2 turns.',
  ],
  guillotine: [
    'Each attack on a target below 50% HP has a 20% chance to instantly KO it.',
    'Each attack on a target below 50% HP has a 40% chance to instantly KO it.',
  ],
  rollout: [
    'Each attack deals additional damage equal to 15% of this Pokémon\'s SPD.',
    'Each attack deals additional damage equal to 30% of this Pokémon\'s SPD.',
  ],
  solarBeam: [
    'At the end of turn 3, fires a solar beam at a random enemy for 300% ATK damage. Once per battle.',
    'At the end of turn 2, fires a solar beam at a random enemy for 300% ATK damage. Once per battle.',
  ],
  battleArmor: [
    'All allies in the same row take 8% less damage.',
    'All allies in the same row take 15% less damage.',
  ],
  limber: [
    'Attacks target the enemy back row first.',
  ],
  ironFist: [
    'Every second attack deals 50% more damage.',
  ],
  cloudNine: [
    'At the start of battle, stuns both enemies in the same column for 2 turns.',
  ],
  aftermath: [
    'When fainted, deals damage equal to 30% of max HP to the attacker.',
    'When fainted, deals damage equal to 50% of max HP to the attacker.',
  ],
  naturalCure: [
    'At the end of each turn, cures status conditions on itself and adjacent same-row allies.',
  ],
  constrict: [
    'Each attack permanently reduces the target\'s SPD by 50%.',
  ],
  parentalBond: [
    'Attacks hit twice, each at 60% damage.',
  ],
  toxicSpike: [
    'Every time it is hit, poisons the attacker for 2.',
    'Every time it is hit, poisons the attacker for 4.',
  ],
  predatorsMark: [
    'At the start of battle, all enemies lose 5% of their max HP.',
    'At the start of battle, all enemies lose 10% of their max HP.',
  ],
  mimic: [
    'At the start of battle, copies the ability of the enemy in the same column.',
  ],
  predator: [
    'Deals 50% more damage to enemies below 50% HP.',
  ],
  disrupt: [
    'At the start of battle, disables every other start-of-battle ability on the field.',
  ],
  discharge: [
    'Each attack also deals 20% damage to other enemies in the same row.',
  ],
  flameBody: [
    'When struck, always burns the attacker for 3.',
  ],
  viceGrip: [
    'Each attack permanently reduces the target\'s ATK by 15%.',
  ],
  trample: [
    'Attacks on front-row enemies also deal 30% damage to the back-row enemy in the same column.',
  ],
  intimidate: [
    'At the start of battle, the enemy in this Pokémon\'s column loses 5% ATK.',
    'At the start of battle, the enemy in this Pokémon\'s column loses 50% ATK.',
  ],
  whaleSong: [
    'At the end of turn 3, all allies recover 50% of max HP. Once per battle.',
  ],
  imposter: [
    'At the start of battle, becomes an identical copy of the ally directly to its left.',
  ],
  explosion: [
    'At the start of battle, faints itself and defeats the enemy in the same row and column as this Pokémon.',
  ],
  spiralShell: [
    'Each time this Pokémon is hit, the next outgoing attack deals 20% bonus damage.',
    'Each time this Pokémon is hit, the next outgoing attack deals 40% bonus damage.',
  ],
  megaDrain: [
    'Restores 25% of damage dealt as HP.',
    'Restores 40% of damage dealt as HP.',
  ],
  skyHigh: [
    'Cannot be targeted while any teammate is still alive. Once it is the last Pokémon standing, it becomes targetable.',
  ],
  thickFat: [
    'Starts every battle with 30% extra max HP.',
  ],
  marvelScale: [
    'While suffering any status condition, takes 25% less damage.',
    'While suffering any status condition, takes 35% less damage.',
    'While suffering any status condition, takes 50% less damage.',
  ],
  // ─── Synergy-focused additions ────────────────────────────────────────
  encore: [
    'When the ally in the same column triggers an ability, that ability triggers one additional time.',
  ],
  bodySlam: [
    'Each attack deals additional damage equal to 20% of this Pokémon\'s current HP.',
  ],
  opportunist: [
    'Every time an enemy is newly stunned, this Pokémon makes a free attack against that enemy.',
  ],
  photosynthesis: [
    'Whenever any allied ability triggers, this Pokémon heals 8% of its max HP.',
    'Whenever any allied ability triggers, this Pokémon heals 14% of its max HP.',
    'Whenever any allied ability triggers, this Pokémon heals 20% of its max HP.',
  ],
  boulderRoll: [
    'At the start of battle, charges the opposing Pokémon for 50% of one normal attack\'s damage.',
    'At the start of battle, charges the opposing Pokémon for one full normal attack\'s damage.',
  ],
  angerPoint: [
    'Whenever an ally faints, this Pokémon gains 15% ATK.',
    'Whenever an ally faints, this Pokémon gains 30% ATK.',
  ],
  sunbeam: [
    'Whenever an ally is healed, fire a beam at a random enemy for 15% of normal attack damage.',
    'Whenever an ally is healed, fire a beam at a random enemy for 30% of normal attack damage.',
  ],
};

const ITEM_DESC = {
  tradeCard: 'During Trading: reroll the offered Pokémon once.',
  revive: 'Revive a fainted Pokémon to full HP.',
  xVitamin: 'Target enters next battle with +50% HP/ATK/SPD.',
  greatBall: 'Capture a wild Pokémon at +3 levels.',
  evosoda: 'Target Pokémon gains 3 levels.',
  tm: 'Reroll the secondary type of a Pokémon. Mono → adds; dual → rerolls.',
  hm: 'Reroll the Pokémon\'s ability (same evolutionary tier).',
  lure: 'During Wild Encounter: swap to a random Pokémon.',
  spiritPendant: 'Release a Pokémon; both adjacent team members gain +1 level.',
};

export function abilityTooltip(abilityId, stage = 1) {
  const arr = ABILITY_DESC[abilityId];
  if (!arr) return '';
  const idx = Math.min(arr.length - 1, Math.max(0, (stage || 1) - 1));
  // Localized override first — `ability.<id>.desc.<stage>` (1-indexed stage). Falls
  // back to the English copy in ABILITY_DESC if no translation key exists.
  const key = `ability.${abilityId}.desc.${idx + 1}`;
  const localized = t(key);
  if (localized !== key) return localized;
  return arr[idx];
}

// Pretty name from camelCase id, e.g. "willOWisp" → "Will-O-Wisp"
const ABILITY_NICE_NAME = {
  willOWisp:'Will-O-Wisp', rockyHelmet:'Rocky Helmet', poisonPoint:'Poison Point',
  shedSkin:'Shed Skin', sandVeil:'Sand Veil', echolocation:'Echolocation',
  effectSpore:'Effect Spore', arenaTrap:'Arena Trap', vitalSpirit:'Vital Spirit',
  waterAbsorb:'Water Absorb', waterVeil:'Water Veil', magicGuard:'Magic Guard',
  crossChop:'Cross Chop', toxicSweat:'Toxic Sweat', toxicSpike:'Toxic Spike',
  pungentAura:'Pungent Aura', rockHead:'Rock Head', earlyBird:'Early Bird',
  rollout:'Rollout', solarBeam:'Solar Beam', battleArmor:'Battle Armor',
  ironFist:'Iron Fist', cloudNine:'Cloud Nine', naturalCure:'Natural Cure',
  parentalBond:'Parental Bond', predatorsMark:"Predator's Mark",
  flameBody:'Flame Body', viceGrip:'Vice Grip', whaleSong:'Whale Song',
  spiralShell:'Spiral Shell', megaDrain:'Mega Drain', skyHigh:'Sky High',
  thickFat:'Thick Fat', marvelScale:'Marvel Scale', guillotine:'Guillotine',
  magnetPull:'Magnet Pull', runAway:'Run Away', tailwind:'Tailwind',
  overgrowth:'Overgrowth', blaze:'Blaze', shellBash:'Shell Bash', static:'Static',
  adaptability:'Adaptability', helpingHand:'Helping Hand', pickup:'Pickup', lullaby:'Lullaby',
  sniper:'Sniper', chlorophyll:'Chlorophyll', gluttony:'Gluttony',
  damp:'Damp', coil:'Coil', stamina:'Stamina', rivalry:'Rivalry',
  healer:'Healer', moxie:'Moxie', mimic:'Mimic', limber:'Limber',
  // New synergy-themed abilities
  encore:'Encore', bodySlam:'Body Slam', opportunist:'Opportunist',
  photosynthesis:'Photosynthesis', boulderRoll:'Boulder Roll',
  angerPoint:'Anger Point', sunbeam:'Sunbeam',
  yawn:'Yawn', rest:'Rest', withdraw:'Withdraw', hex:'Hex',
  hypnosis:'Hypnosis', discharge:'Discharge', constrict:'Constrict',
  predator:'Predator', disrupt:'Disrupt', trample:'Trample',
  intimidate:'Intimidate', imposter:'Imposter', explosion:'Explosion',
  aftermath:'Aftermath',
};
export function abilityName(id) {
  // Localized override first — `ability.<id>.name`. Falls back to the English nice
  // name then the raw id.
  const key = `ability.${id}.name`;
  const localized = t(key);
  if (localized !== key) return localized;
  return ABILITY_NICE_NAME[id] || id;
}

export function itemTooltip(itemId) {
  // Localized description first; fall back to the hard-coded English copy then ''.
  const key = `item.${itemId}.desc`;
  const localized = t(key);
  if (localized !== key) return localized;
  return ITEM_DESC[itemId] || '';
}

// ─── Tooltip ──────────────────────────────────────────────────────────────
let tooltipEl = null;
let tooltipOwner = null;                  // currently-hovered element that "owns" the tooltip
function getTooltip() { return tooltipEl ||= $('#tooltip'); }

// Force the tooltip closed. Called on every setPhase() / renderItems() / renderTeam()
// so a re-render that yanks the hovered element out of the DOM doesn't leave the
// tooltip orphaned on screen (the original bug: mouseleave never fires for a removed
// node, so without this the tooltip stays visible until the next mouseenter).
export function hideTooltip() {
  const tt = getTooltip();
  if (tt) tt.classList.add('hidden');
  tooltipOwner = null;
}

export function attachTooltip(el, title, body, opts = {}) {
  const show = (e) => {
    const tt = getTooltip();
    tt.className = 'tooltip' + (opts.rich ? ' rich' : '');
    tt.innerHTML = opts.rich ? body : `<div class="tname">${escape(title)}</div>${escape(body)}`;
    tt.classList.remove('hidden');
    tooltipOwner = el;
    const r = el.getBoundingClientRect();
    // After content is set we can measure the tooltip width
    const ttRect = tt.getBoundingClientRect();
    let left = r.left + r.width / 2 - ttRect.width / 2;
    left = Math.max(8, Math.min(window.innerWidth - ttRect.width - 8, left));
    let top = r.bottom + 8;
    if (top + ttRect.height > window.innerHeight - 8) top = r.top - ttRect.height - 8;
    tt.style.left = left + 'px';
    tt.style.top  = top + 'px';
  };
  const hide = () => {
    if (tooltipOwner === el) { getTooltip().classList.add('hidden'); tooltipOwner = null; }
  };
  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hide);
  el.addEventListener('touchstart', (e) => { show(e); setTimeout(hide, 3000); }, { passive: true });
}

function escape(s) { return (s + '').replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }

// ─── HUD ──────────────────────────────────────────────────────────────────
// Format a number with comma thousand-separators. Used for the money counter so
// large balances ($1,250) read cleanly instead of running together ($1250).
function formatMoney(n) {
  return (n | 0).toLocaleString('en-US');
}

// Previous HUD state — used to detect deltas (money change, strike loss) so we can
// trigger one-shot animations on the change frame only.
let prevMoney = null;
let prevStrikes = null;
let moneyTweenRaf = null;

// Smoothly count #money from its currently-displayed value to `target` over ~400ms,
// stopping any in-flight tween first. Cheaper than mounting a real animation library
// for one element; we use requestAnimationFrame and integer rounding.
function tweenMoney(target) {
  const el = $('#money');
  if (!el) return;
  if (moneyTweenRaf) cancelAnimationFrame(moneyTweenRaf);
  const startText = (el.textContent || '').replace(/[^\d-]/g, '');
  const start = startText === '' ? target : parseInt(startText, 10);
  if (start === target) { el.textContent = formatMoney(target); return; }
  const duration = 400;
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    // Ease-out cubic: fast start, slow finish — matches "money lands" feel.
    const eased = 1 - Math.pow(1 - t, 3);
    const v = Math.round(start + (target - start) * eased);
    el.textContent = formatMoney(v);
    if (t < 1) moneyTweenRaf = requestAnimationFrame(step);
    else       moneyTweenRaf = null;
  };
  moneyTweenRaf = requestAnimationFrame(step);
}

// Spawn a transient "+$N" / "−$N" floating popup near the money counter. CSS handles
// the float-up + fade-out keyframe; we just attach an element and let it self-remove.
function popMoneyDelta(delta) {
  const moneyEl = $('#money');
  if (!moneyEl) return;
  // Append to <body> as a fixed-position element anchored to the money counter's
  // bounding rect. We can't put it inside #money because the tween rewrites that
  // element's textContent and would wipe the popup; we can't put it in the topbar
  // either because it'd overflow badges/strikes. Fixed positioning sidesteps both.
  const r = moneyEl.getBoundingClientRect();
  const pop = document.createElement('div');
  pop.className = `money-pop ${delta >= 0 ? 'gain' : 'loss'}`;
  pop.textContent = (delta >= 0 ? '+$' : '−$') + formatMoney(Math.abs(delta));
  pop.style.left = `${r.right - 4}px`;
  pop.style.top  = `${r.bottom + 2}px`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);
}

export function renderTopbar(state) {
  $('#topbar').classList.remove('hidden');
  $('#bottombar').classList.remove('hidden');
  $('#player-name').textContent = state.playerName;
  const r = rankFromElo(state.elo);
  // Show only the ball icon + the sub-level in Roman numerals (no tier word).
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const subLabel = ROMAN[r.sub] || String(r.sub);
  $('#player-rank').innerHTML = `<img src="${rankIcon(r.tier)}" class="rank-icon" alt="${r.tier} Ball" loading="lazy"><span class="rank-sub">${subLabel}</span>`;

  // Badges — 5 slots, fill the first `state.badges` of them with their themed gradient.
  $('#badges-display').innerHTML = Array.from({ length: 5 }, (_, i) =>
    i < state.badges
      ? `<div class="badge-slot filled b${i + 1}"></div>`
      : `<div class="badge-slot"></div>`
  ).join('');

  // Strikes — 3 lightning bolts, grey out as they're spent. When a strike was just
  // consumed (prevStrikes > state.strikes), flash the newly-spent bolt red briefly.
  const strikeJustLost = prevStrikes != null && state.strikes < prevStrikes;
  const lostIndex = strikeJustLost ? (3 - prevStrikes) : -1;     // the bolt that just turned spent
  $('#strikes-display').innerHTML = Array.from({ length: 3 }, (_, i) => {
    const spent = i < (3 - state.strikes);
    const flashCls = i === lostIndex ? ' just-lost' : '';
    return `<span class="strike${spent ? ' spent' : ''}${flashCls}">⚡</span>`;
  }).join('');

  // Money — tween from previous to new value and spawn a floating delta popup. The
  // first render seeds prevMoney without firing animations.
  if (prevMoney == null) {
    $('#money').textContent = formatMoney(state.money);
  } else if (state.money !== prevMoney) {
    tweenMoney(state.money);
    popMoneyDelta(state.money - prevMoney);
  }
  prevMoney = state.money;
  prevStrikes = state.strikes;
}

// Reset cached HUD state — call at run boundaries (newRun / resumeRun / endRun) so
// the first renderTopbar after a fresh load seeds without spurious animations.
export function resetTopbarTrack() {
  prevMoney = null;
  prevStrikes = null;
  if (moneyTweenRaf) { cancelAnimationFrame(moneyTweenRaf); moneyTweenRaf = null; }
}

// Step dots in the top bar — pass null to hide. When the current step advances we tag
// the new dot with .just-activated for a one-shot fill animation in CSS.
// Count tracks the new 9-step adventure layout (3 sets of 3).
const TOPBAR_STEP_COUNT = 9;
let prevStepShown = null;
export function setTopbarStep(currentStep) {
  const el = $('#step-dots');
  if (!el) return;
  if (currentStep == null) { el.innerHTML = ''; prevStepShown = null; return; }
  const justActivated = prevStepShown != null && currentStep > prevStepShown ? currentStep : -1;
  el.innerHTML = Array.from({ length: TOPBAR_STEP_COUNT }, (_, i) => {
    const status = i < currentStep ? 'done' : i === currentStep ? 'current' : '';
    const flash = i === justActivated ? ' just-activated' : '';
    return `<div class="step-dot ${status}${flash}"></div>`;
  }).join('');
  prevStepShown = currentStep;
}

// Stat caps used to size the bars. Tuned to actual stat distributions so the bar
// compositions show what a Pokémon is *focused* on rather than just "everything has
// way more HP than ATK/SPD". HP scales with level much faster and has a much higher
// base, so its bar uses a 500 ceiling; ATK and SPD share a 160 ceiling and end up
// taking up a similar fraction of their bar.
const STAT_CAP = { hp: 500, atk: 160, spd: 160 };
function pct(value, cap) { return Math.max(0, Math.min(100, Math.round(value / cap * 100))); }

// Reusable Pokémon card content (the inner of a .slot). Works for team / starter / wild / trade.
// Accepts an instance with: speciesId, level, hp, hpMax, atk, spd, type1, type2, ability.
export function pokemonCardInnerHTML(p) {
  const sp = SPECIES[p.speciesId];
  const t1 = p.type1 || sp.type1;
  const t2 = p.type2 || sp.type2;
  const types = [t1, t2].filter(Boolean)
    .map(typ => `<span class="type-capsule type-${typ}">${t('type.' + typ)}</span>`).join('');
  const hpMax = p.hpMax;
  const hp = (p.hp != null) ? p.hp : hpMax;
  const hpClass = hp / hpMax < 0.3 ? ' hp-low' : '';
  const hpLabel = (hp === hpMax) ? `${hpMax}` : `${hp}/${hpMax}`;
  const abilityId = p.ability || sp.ability;
  return `
    <div class="slot-main">
      <div class="slot-sprite-wrap"><img class="slot-sprite" src="${SPRITE_URL(sp.id)}" alt="${sp.name}" loading="lazy"></div>
      <div class="slot-info">
        <div class="slot-header">
          <span class="slot-name">${sp.name}</span>
          <span class="slot-level">${t('slot.level', p.level)}</span>
        </div>
        <div class="slot-types">${types}</div>
        <div class="slot-stats">
          <div class="stat-row">
            <label>${t('stat.hp')}</label>
            <div class="stat-bar hp"><div style="width:${pct(hpMax, STAT_CAP.hp)}%"></div></div>
            <span class="stat-val${hpClass}">${hpLabel}</span>
          </div>
          <div class="stat-row">
            <label>${t('stat.atk')}</label>
            <div class="stat-bar atk"><div style="width:${pct(p.atk, STAT_CAP.atk)}%"></div></div>
            <span class="stat-val">${p.atk}</span>
          </div>
          <div class="stat-row">
            <label>${t('stat.spd')}</label>
            <div class="stat-bar spd"><div style="width:${pct(p.spd, STAT_CAP.spd)}%"></div></div>
            <span class="stat-val">${p.spd}</span>
          </div>
        </div>
      </div>
    </div>
    <div class="slot-ability">${abilityTooltip(abilityId, sp.stage)}</div>
  `;
}

export function renderTeam(state, opts = {}) {
  // Same anti-orphan tooltip cleanup as renderItems — the slot the tooltip was attached
  // to is about to be wiped, and a removed node never fires mouseleave.
  hideTooltip();
  const grid = $('#team-display');
  grid.innerHTML = '';
  // Order: F1 F2 F3 on top row, B1 B2 B3 on bottom row.
  for (const slot of ['F1','F2','F3','B1','B2','B3']) {
    const div = document.createElement('div');
    div.className = 'slot';
    div.dataset.slot = slot;
    const p = state.team[slot];
    if (!p) {
      div.classList.add('empty');
      div.innerHTML = '';
    } else {
      div.innerHTML = pokemonCardInnerHTML(p);
      if (p.fainted) div.classList.add('fainted');
      if (p.inDaycare) {
        // Daycare Pokémon stay on the team display but greyed out — they don't deploy in
        // battle and can't be released/sold/given items until the next adventure begins.
        div.classList.add('in-daycare');
        const tag = document.createElement('div');
        tag.className = 'daycare-tag';
        tag.textContent = t('daycare.tag');
        div.appendChild(tag);
      }
      // Drag source — locked while at daycare to keep the player from selling/trading/feeding
      // a Pokémon that isn't actually there.
      if (!p.inDaycare) {
        div.draggable = true;
        div.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({ type:'pokemon', slot }));
          // Mirror the drag payload onto window so drop targets can read it during dragover
          // (dataTransfer.getData is otherwise locked to the drop event for security reasons).
          window.__pmDrag = { type: 'pokemon', slot };
        });
        div.addEventListener('dragend', () => { window.__pmDrag = null; });
      }
      // (Release button removed — letting the player cull the team on demand made it too
      // easy to keep only top performers. Selling at Town is still the way to free a slot.)
    }
    // Drag target (for reorder + item drop)
    div.addEventListener('dragover', (e) => { e.preventDefault(); div.classList.add('drag-over'); });
    div.addEventListener('dragleave', () => div.classList.remove('drag-over'));
    div.addEventListener('drop', (e) => {
      e.preventDefault(); div.classList.remove('drag-over');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === 'pokemon' && data.slot !== slot) opts.onSwap?.(data.slot, slot);
        else if (data.type === 'item') opts.onUseItem?.(data.itemId, { type:'pokemon', slot });
      } catch {}
    });
    grid.appendChild(div);
  }
}

// Track item IDs per slot from render to render so newly-arrived items can play a
// scale-in animation on first appearance (a slot transitioning from empty → filled,
// or from one item to a different item, both count as "new").
let prevItemIds = [null, null, null];
export function renderItems(state, opts = {}) {
  // Re-rendering nukes any tooltip whose owner was an item slot — clear it preemptively.
  hideTooltip();
  const box = $('#item-slots');
  box.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const div = document.createElement('div');
    div.className = 'item-slot';
    const item = state.items[i];
    if (item) {
      div.classList.add('filled');
      // Tag a freshly-arrived item so CSS can play the pop-in keyframe once.
      if (prevItemIds[i] !== item.id) div.classList.add('just-filled');
      const def = ITEMS[item.id] || BERRIES[item.id];
      const iconUrl = itemIcon(item.id);
      const isBerry = BERRIES[item.id] != null;
      const isSmallBerry = isBerry && BERRIES[item.id].small;
      const iconClass = `item-icon${isSmallBerry ? ' item-icon-small' : ''}`;
      // Display name via i18n — falls back to data.js name if no translation exists,
      // then to the bare item id as a last resort.
      const nameKey = (isBerry ? 'berry.' : 'item.') + item.id + '.name';
      const localizedName = t(nameKey) !== nameKey ? t(nameKey) : (def?.name || item.id);
      div.innerHTML = `
        ${iconUrl ? `<img src="${iconUrl}" class="${iconClass}" alt="${localizedName}" loading="lazy">` : ''}
        <span class="item-name">${localizedName}</span>
      `;
      div.draggable = true;
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type:'item', slotIdx: i, itemId: item.id }));
        // Mirror onto window so drop targets (e.g. Town's sell zone) can read the drag
        // payload during dragover — dataTransfer.getData is locked outside of `drop`.
        window.__pmDrag = { type: 'item', slotIdx: i, itemId: item.id };
      });
      div.addEventListener('dragend', () => { window.__pmDrag = null; });
      const tooltipBody = isBerry
        ? t('berry.tooltip', t('stat.' + BERRIES[item.id].stat), isSmallBerry ? 5 : 20)
        : itemTooltip(item.id);
      attachTooltip(div, localizedName, tooltipBody);
    } else {
      div.textContent = '';
    }
    box.appendChild(div);
  }
  // Snapshot current ids for next render's "what's new" diff.
  prevItemIds = state.items.map(it => it ? it.id : null);
}

export function setPhase(html) {
  // Always nuke any open tooltip when the page changes — its owner element is about to
  // be removed from the DOM, and a removed node never fires mouseleave (the original
  // "tooltip sticks" bug).
  hideTooltip();
  const host = $('#phase-host');
  host.innerHTML = html;
  // Re-trigger the CSS fade-in keyframe by toggling the class off and forcing a reflow
  // before re-adding it. Without the void access the browser fast-paths the toggle and
  // the animation doesn't replay on consecutive setPhase calls.
  host.classList.remove('phase-fade-in');
  void host.offsetWidth;                                    // reflow
  host.classList.add('phase-fade-in');
}

export function phaseHeader(title, subtitle = '', rightHtml = '', titleSuffix = '') {
  // `rightHtml` lets callers inject content (e.g. battle speed buttons) into the right
  // side of the header — .phase-header is a flex with justify-content: space-between,
  // so the right slot docks to the far edge automatically.
  // `titleSuffix` is raw HTML appended *inside* the .phase-title element, right after
  // the (escaped) title text — handy for inline badges like the Victory/Defeat verdict.
  return `<div class="phase-header"><div><div class="phase-title">${escape(title)}${titleSuffix || ''}</div>${subtitle ? `<div class="phase-subtitle">${escape(subtitle)}</div>` : ''}</div>${rightHtml || ''}</div>`;
}
