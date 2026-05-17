// PokeMini — static data tables.
// Species stats derived from Gen 1 base stats per GDD §6.1:
//   HP  = max(base HP, base DEF, base SP.DEF)
//   ATK = max(base ATK, base SP.ATK)
//   SPD = base SPEED
// Each line shares one ability (see abilities.js).

// ─── Type chart (Gen 2+ corrected; decision #4) ──────────────────────────────
// Multiplier of attacker → defender. Missing = 1×.
export const TYPES = [
  'normal','fire','water','electric','grass','ice','fighting','poison',
  'ground','flying','psychic','bug','rock','ghost','dragon'
];

export const TYPE_CHART = {
  normal:   { rock:0.5, ghost:0, },
  fire:     { fire:0.5, water:0.5, grass:2, ice:2, bug:2, rock:0.5, dragon:0.5 },
  water:    { fire:2, water:0.5, grass:0.5, ground:2, rock:2, dragon:0.5 },
  electric: { water:2, electric:0.5, grass:0.5, ground:0, flying:2, dragon:0.5 },
  grass:    { fire:0.5, water:2, grass:0.5, poison:0.5, ground:2, flying:0.5, bug:0.5, rock:2, dragon:0.5 },
  ice:      { fire:0.5, water:0.5, grass:2, ice:0.5, ground:2, flying:2, dragon:2 },
  fighting: { normal:2, ice:2, poison:0.5, flying:0.5, psychic:0.5, bug:0.5, rock:2, ghost:0 },
  poison:   { grass:2, poison:0.5, ground:0.5, bug:2, rock:0.5, ghost:0.5 },
  ground:   { fire:2, electric:2, grass:0.5, poison:2, flying:0, bug:0.5, rock:2 },
  flying:   { electric:0.5, grass:2, fighting:2, bug:2, rock:0.5 },
  psychic:  { fighting:2, poison:2, psychic:0.5 },
  bug:      { fire:0.5, grass:2, fighting:0.5, poison:0.5, flying:0.5, psychic:2, ghost:0.5 },
  rock:     { fire:2, ice:2, fighting:0.5, ground:0.5, flying:2, bug:2 },
  ghost:    { normal:0, psychic:2, ghost:2 },
  dragon:   { dragon:2 }
};

export function typeMult(attackerType, defenderTypes) {
  if (!attackerType) return 1;
  const row = TYPE_CHART[attackerType] || {};
  let m = 1;
  for (const t of defenderTypes) if (t && row[t] !== undefined) m *= row[t];
  return m;
}

// ─── Species ─────────────────────────────────────────────────────────────────
// Compact format: [id, name, t1, t2|null, hp, atk, spd, abilityId, evolvesTo|null, evolvesAt|null, stage]
const _S = [
  // Starter lines
  [1,  'Bulbasaur',  'grass','poison', 65, 65, 45, 'overgrowth',  2,  16, 1],
  [2,  'Ivysaur',    'grass','poison', 80, 80, 60, 'overgrowth',  3,  32, 2],
  [3,  'Venusaur',   'grass','poison',100,100, 80, 'overgrowth',  null,null,3],
  [4,  'Charmander', 'fire',  null,    58, 60, 65, 'blaze',       5,  16, 1],
  [5,  'Charmeleon', 'fire',  null,    78, 80, 80, 'blaze',       6,  36, 2],
  [6,  'Charizard',  'fire',  'flying',104,109,100, 'blaze',      null,null,3],
  [7,  'Squirtle',   'water', null,    65, 50, 43, 'shellBash',   8,  16, 1],
  [8,  'Wartortle',  'water', null,    80, 65, 58, 'shellBash',   9,  36, 2],
  [9,  'Blastoise',  'water', null,   105, 85, 78, 'shellBash',   null,null,3],
  [10, 'Caterpie',   'bug',   null,    45, 30, 45, 'shedSkin',    11, 7,  1],
  [11, 'Metapod',    'bug',   null,    50, 20, 30, 'shedSkin',    12, 10, 2],
  [12, 'Butterfree', 'bug',  'flying', 60, 90, 70, 'shedSkin',    null,null,3],
  [13, 'Weedle',     'bug',  'poison', 40, 35, 50, 'poisonPoint', 14, 7,  1],
  [14, 'Kakuna',     'bug',  'poison', 45, 25, 35, 'poisonPoint', 15, 10, 2],
  [15, 'Beedrill',   'bug',  'poison', 65, 90, 75, 'poisonPoint', null,null,3],
  [16, 'Pidgey',     'normal','flying',40, 45, 56, 'tailwind',    17, 18, 1],
  [17, 'Pidgeotto',  'normal','flying',63, 60, 71, 'tailwind',    18, 36, 2],
  [18, 'Pidgeot',    'normal','flying',83, 80,101, 'tailwind',    null,null,3],
  [19, 'Rattata',    'normal',null,    30, 56, 72, 'opportunist', 20, 20, 1],
  [20, 'Raticate',   'normal',null,    60, 81, 97, 'opportunist', null,null,2],
  [21, 'Spearow',    'normal','flying',40, 60, 70, 'sniper',      22, 20, 1],
  [22, 'Fearow',     'normal','flying',65, 90,100, 'sniper',      null,null,2],
  [23, 'Ekans',      'poison',null,    54, 60, 55, 'coil',        24, 22, 1],
  [24, 'Arbok',      'poison',null,    79, 95, 80, 'coil',        null,null,2],
  [25, 'Pikachu',    'electric',null,  40, 55, 90, 'static',      26, 30, 1],
  [26, 'Raichu',     'electric',null,  60,100,110, 'static',      null,null,2],
  [27, 'Sandshrew',  'ground',null,    50, 75, 40, 'sandVeil',    28, 22, 1],
  [28, 'Sandslash',  'ground',null,    80,100, 65, 'sandVeil',    null,null,2],
  [29, 'NidoranF',   'poison',null,    65, 47, 41, 'stamina',     30, 16, 1],
  [30, 'Nidorina',   'poison',null,    80, 62, 56, 'stamina',     31, 36, 2],
  [31, 'Nidoqueen',  'poison','ground',97, 92, 76, 'stamina',     null,null,3],
  [32, 'NidoranM',   'poison',null,    65, 57, 50, 'rivalry',     33, 16, 1],
  [33, 'Nidorino',   'poison',null,    81, 72, 65, 'rivalry',     34, 36, 2],
  [34, 'Nidoking',   'poison','ground',91,102, 85, 'rivalry',     null,null,3],
  [35, 'Clefairy',   'normal',null,    73, 60, 35, 'healer',      36, 34, 1],
  [36, 'Clefable',   'normal',null,    98, 85, 60, 'healer',      null,null,2],
  [37, 'Vulpix',     'fire',  null,    49, 54, 65, 'willOWisp',   38, 35, 1],
  [38, 'Ninetales',  'fire',  null,    81, 81,100, 'willOWisp',   null,null,2],
  [39, 'Jigglypuff', 'normal',null,   115, 45, 20, 'lullaby',     40, 30, 1],
  [40, 'Wigglytuff', 'normal',null,   140, 70, 45, 'lullaby',     null,null,2],
  [41, 'Zubat',      'poison','flying',40, 45, 55, 'echolocation',42, 22, 1],
  [42, 'Golbat',     'poison','flying',75, 80, 90, 'echolocation',null,null,2],
  [43, 'Oddish',     'grass','poison', 65, 75, 30, 'chlorophyll', 44, 21, 1],
  [44, 'Gloom',      'grass','poison', 85, 85, 40, 'chlorophyll', 45, 34, 2],
  [45, 'Vileplume',  'grass','poison',100,110, 50, 'chlorophyll', null,null,3],
  [46, 'Paras',      'bug',  'grass',  60, 70, 25, 'effectSpore', 47, 24, 1],
  [47, 'Parasect',   'bug',  'grass',  80,105, 30, 'effectSpore', null,null,2],
  [50, 'Diglett',    'ground',null,    30, 55, 95, 'arenaTrap',   51, 26, 1],
  [51, 'Dugtrio',    'ground',null,    50,100,120, 'arenaTrap',   null,null,2],
  [52, 'Meowth',     'normal',null,    40, 45, 90, 'pickup',      53, 28, 1],
  [53, 'Persian',    'normal',null,    65, 70,115, 'pickup',      null,null,2],
  [54, 'Psyduck',    'water', null,    65, 65, 55, 'damp',        55, 33, 1],
  [55, 'Golduck',    'water', null,    95, 95, 85, 'damp',        null,null,2],
  [56, 'Mankey',     'fighting',null,  50, 80, 70, 'angerPoint',  57, 28, 1],
  [57, 'Primeape',   'fighting',null,  85,105, 95, 'angerPoint',  null,null,2],
  [58, 'Growlithe',  'fire',  null,    65, 70, 60, 'moxie',       59, 40, 1],
  [59, 'Arcanine',   'fire',  null,   100,110, 95, 'moxie',       null,null,2],
  [60, 'Poliwag',    'water', null,    40, 50, 90, 'waterVeil',   61, 25, 1],
  [61, 'Poliwhirl',  'water', null,    65, 65, 90, 'waterVeil',   62, 37, 2],
  [62, 'Poliwrath',  'water','fighting',90,95, 70, 'waterVeil',   null,null,3],
  [63, 'Abra',       'psychic',null,   35, 105, 90, 'magicGuard', 64, 16, 1],
  [64, 'Kadabra',    'psychic',null,   55, 120,105, 'magicGuard', 65, 37, 2],
  [65, 'Alakazam',   'psychic',null,   70, 135,120, 'magicGuard', null,null,3],
  [66, 'Machop',     'fighting',null,  70, 80, 35, 'crossChop',   67, 28, 1],
  [67, 'Machoke',    'fighting',null,  85,100, 45, 'crossChop',   68, 40, 2],
  [68, 'Machamp',    'fighting',null, 100,130, 55, 'crossChop',   null,null,3],
  [69, 'Bellsprout', 'grass','poison', 60, 75, 40, 'photosynthesis',70, 21, 1],
  [70, 'Weepinbell', 'grass','poison', 80, 95, 55, 'photosynthesis',71, 34, 2],
  [71, 'Victreebel', 'grass','poison',100,125, 70, 'photosynthesis',null,null,3],
  [72, 'Tentacool',  'water','poison', 50, 50, 70, 'toxicSweat',  73, 30, 1],
  [73, 'Tentacruel', 'water','poison', 80, 80,100, 'toxicSweat',  null,null,2],
  [74, 'Geodude',    'rock','ground',  55, 80, 20, 'rockyHelmet', 75, 25, 1],
  [75, 'Graveler',   'rock','ground',  75,105, 35, 'rockyHelmet', 76, 38, 2],
  [76, 'Golem',      'rock','ground',  90,130, 45, 'rockyHelmet', null,null,3],
  [79, 'Slowpoke',   'water','psychic',90, 65, 15, 'yawn',        80, 37, 1],
  [80, 'Slowbro',    'water','psychic',110,95, 30, 'yawn',        null,null,2],
  [81, 'Magnemite',  'electric',null,  50, 95, 45, 'magnetPull',  82, 30, 1],
  [82, 'Magneton',   'electric',null,  70,120, 70, 'magnetPull',  null,null,2],
  [84, 'Doduo',      'normal','flying',35, 85, 75, 'earlyBird',   85, 31, 1],
  [85, 'Dodrio',     'normal','flying',60,110,110, 'earlyBird',   null,null,2],
  [86, 'Seel',       'water', null,    65, 45, 45, 'rest',        87, 34, 1],
  [87, 'Dewgong',    'water','ice',    95, 70, 70, 'rest',        null,null,2],
  [88, 'Grimer',     'poison',null,    80, 80, 25, 'pungentAura', 89, 38, 1],
  [89, 'Muk',        'poison',null,   105,105, 50, 'pungentAura', null,null,2],
  [90, 'Shellder',   'water', null,    50, 65, 40, 'withdraw',    91, 30, 1],
  [91, 'Cloyster',   'water','ice',   180, 95, 70, 'withdraw',    null,null,2],
  [92, 'Gastly',     'ghost','poison', 30, 100, 80, 'hex',        93, 25, 1],
  [93, 'Haunter',    'ghost','poison', 45, 115, 95, 'hex',        94, 37, 2],
  [94, 'Gengar',     'ghost','poison', 75, 130,110, 'hex',        null,null,3],
  [95, 'Onix',       'rock','ground', 160, 45, 70, 'rockHead',    null,null,1],
  [96, 'Drowzee',    'psychic',null,   60, 73, 42, 'hypnosis',    97, 26, 1],
  [97, 'Hypno',      'psychic',null,   90, 73, 67, 'hypnosis',    null,null,2],
  [98, 'Krabby',     'water', null,    40,105, 50, 'guillotine',  99, 28, 1],
  [99, 'Kingler',    'water', null,    65,130, 75, 'guillotine',  null,null,2],
  [100,'Voltorb',    'electric',null,  40, 55,100, 'rollout',    101, 30, 1],
  [101,'Electrode',  'electric',null,  60, 80,150, 'rollout',     null,null,2],
  [102,'Exeggcute',  'grass','psychic',60, 60, 40, 'sunbeam',    103, 30, 1],
  [103,'Exeggutor',  'grass','psychic',95,125, 55, 'sunbeam',     null,null,2],
  [104,'Cubone',     'ground',null,    50, 50, 35, 'battleArmor',105, 28, 1],
  [105,'Marowak',    'ground',null,    80,100, 45, 'battleArmor', null,null,2],
  [106,'Hitmonlee',  'fighting',null,  50,120, 87, 'limber',      null,null,1],
  [107,'Hitmonchan', 'fighting',null,  50,105, 76, 'ironFist',    null,null,1],
  [108,'Lickitung',  'normal',null,    90, 55, 30, 'cloudNine',   null,null,1],
  [109,'Koffing',    'poison',null,    40, 95, 35, 'aftermath',  110, 35, 1],
  [110,'Weezing',    'poison',null,    65,110, 60, 'aftermath',   null,null,2],
  [111,'Rhyhorn',    'rock','ground',  95, 85, 25, 'boulderRoll',112, 42, 1],
  [112,'Rhydon',     'rock','ground', 120,130, 40, 'boulderRoll',null,null,2],
  [113,'Chansey',    'normal',null,    250, 35, 50, 'naturalCure',null,null,1],
  [114,'Tangela',    'grass', null,    65,100, 60, 'constrict',   null,null,1],
  [115,'Kangaskhan', 'normal',null,   105, 95, 90, 'parentalBond',null,null,1],
  [116,'Horsea',     'water', null,    30, 70, 60, 'toxicSpike', 117, 32, 1],
  [117,'Seadra',     'water', null,    55,105, 85, 'toxicSpike',  null,null,2],
  [118,'Goldeen',    'water', null,    45, 67, 63, 'predatorsMark',119,33, 1],
  [119,'Seaking',    'water', null,    80, 92, 68, 'predatorsMark',null,null,2],
  [122,'MrMime',     'psychic',null,   65,100, 90, 'encore',      null,null,1],
  [123,'Scyther',    'bug','flying',   70,110,105, 'predator',    null,null,1],
  [124,'Jynx',       'ice','psychic',  95,115, 95, 'disrupt',     null,null,1],
  [125,'Electabuzz', 'electric',null,  85, 95,105, 'discharge',   null,null,1],
  [126,'Magmar',     'fire',null,      75, 95, 93, 'flameBody',   null,null,1],
  [127,'Pinsir',     'bug',null,       65,125, 85, 'viceGrip',    null,null,1],
  [128,'Tauros',     'normal',null,   105,100,110, 'trample',     null,null,1],
  [129,'Magikarp',   'water', null,    20, 10, 80, 'intimidate', 130, 20, 1],
  [130,'Gyarados',   'water','flying', 95,125, 81, 'intimidate',  null,null,2],
  [131,'Lapras',     'water','ice',   130, 95, 60, 'whaleSong',   null,null,1],
  [132,'Ditto',      'normal',null,    48, 48, 48, 'imposter',    null,null,1],
  [133,'Eevee',      'normal',null,    65, 60, 55, 'helpingHand', 134,25, 1],
  [134,'Vaporeon',   'water', null,   130, 95, 65, 'helpingHand',  null,null,2],
  [137,'Porygon',    'normal',null,    75, 75, 40, 'explosion',   null,null,1],
  [138,'Omanyte',    'rock','water',  100, 90, 35, 'spiralShell',139, 40, 1],
  [139,'Omastar',    'rock','water',  125,115, 55, 'spiralShell', null,null,2],
  [140,'Kabuto',     'rock','water',   55, 80, 55, 'megaDrain',  141, 40, 1],
  [141,'Kabutops',   'rock','water',   70,115, 80, 'megaDrain',   null,null,2],
  [142,'Aerodactyl', 'rock','flying',  80,105,130, 'skyHigh',     null,null,1],
  [143,'Snorlax',    'normal',null,   160,110, 30, 'bodySlam',    null,null,1],
  [147,'Dratini',    'dragon',null,    51, 64, 50, 'marvelScale',148,30, 1],
  [148,'Dragonair',  'dragon',null,    71, 84, 70, 'marvelScale',149,47, 2],
  [149,'Dragonite',  'dragon','flying',91,134, 80, 'marvelScale', null,null,3],
];

export const SPECIES = {};
for (const r of _S) SPECIES[r[0]] = {
  id:r[0], name:r[1], type1:r[2], type2:r[3],
  hp:r[4], atk:r[5], spd:r[6], ability:r[7],
  evolvesTo:r[8], evolvesAt:r[9], stage:r[10]
};

export function speciesByName(name) {
  for (const s of Object.values(SPECIES)) if (s.name === name) return s;
  return null;
}

// ─── Items ────────────────────────────────────────────────────────────────
// Revive was retired alongside the "teams always heal after every battle" change —
// nothing ever stays fainted between fights now, so the item had no use case.
export const ITEMS = {
  tradeCard:  { id:'tradeCard', name:'Trade Card', cost:250, target:'tradeEvent' },
  xVitamin:   { id:'xVitamin',  name:'X-Vitamin',  cost:300, target:'pokemon' },
  greatBall:  { id:'greatBall', name:'Great Ball', cost:400, target:'wildEvent' },
  evosoda:    { id:'evosoda',   name:'Evosoda',    cost:500, target:'pokemon' },
  tm:         { id:'tm',        name:'TM',         cost:600, target:'pokemon' },
  hm:         { id:'hm',        name:'HM',         cost:600, target:'pokemon' },
  lure:       { id:'lure',      name:'Lure',       cost:600, target:'wildEvent' },
  spiritPendant: { id:'spiritPendant', name:'Spirit Pendant', cost:400, target:'pokemon' },
};

export const BERRIES = {
  oran:  { id:'oran',  name:'Oran Berry',  stat:'hp',  amount:8 },
  cheri: { id:'cheri', name:'Cheri Berry', stat:'atk', amount:6 },
  salac: { id:'salac', name:'Salac Berry', stat:'spd', amount:6 },
  // Small berries — 1/3 of the standard +15 boost. Awarded when the player chooses
  // "Pick small berries" instead of capturing a Pokémon or fighting a trainer; also
  // the participation drop for adventure trainer battles. The `amount` field below
  // is informational only — the actual bonus is applied via the BONUS constant in
  // the use-item handler (see phases.js).
  oranSmall:  { id:'oranSmall',  name:'Small Oran',  stat:'hp',  amount:8, small:true },
  cheriSmall: { id:'cheriSmall', name:'Small Cheri', stat:'atk', amount:6, small:true },
  salacSmall: { id:'salacSmall', name:'Small Salac', stat:'spd', amount:6, small:true },
};

// ─── Zones ────────────────────────────────────────────────────────────────
// id, name, type focus, gym leader, min (zone floor), level (zone max), species pool, trainer pool
// Wild encounters roll a level in (min+1)..(max-1). Trainers use min+2+advStep. Gym leaders use level (max).
export const ZONES = [
  // Pools rebalanced to 9 per zone (Z7 sits at 8) — see docs/GDD.md §6.5 for the per-zone rationale.
  // Starter species (Pikachu, Meowth, Jigglypuff, NidoranF, Eevee) are intentionally NOT wild.
  // Zone scaling = +7 levels per zone (was +8). Gym level shown — wild range is min+1..level-1.
  //
  // `rares` is the inverse-zone rare list — each rare has RUN.rareWildChance to replace
  // a capture-step pool pick. Zones pair up Z1↔Z7, Z2↔Z6, Z3↔Z5. Z4 has no rares (middle
  // zone with no inverse). Rare picks scale to the zone's normal capture level, so a Z1
  // rare like Pidgey shows as L5 there, while the Z7 Pidgey rare shows as L43+ (Pidgeot).
  { id:1, name:'Pewter / Mt. Moon', type:'rock',     leader:'Brock',     min:2,  level:7,
    pool:[16,19,10,13,74,41,46,69,140],                                    // Pidgey, Rattata, Caterpie, Weedle, Geodude, Zubat, Paras, Bellsprout, Kabuto
    rares:[138, 90, 132] },                                                // Omanyte (fossil), Shellder, Ditto — Mt. Moon cave / fossil flavor
  { id:2, name:'Cerulean / Route 4',type:'water',    leader:'Misty',    min:8,  level:14,
    pool:[129,54,60,118,23,95,66,27,21],                                    // Magikarp, Psyduck, Poliwag, Goldeen, Ekans, Onix, Machop, Sandshrew, Spearow
    rares:[79, 113, 108] },                                                 // Slowpoke (water/psychic), Chansey, Lickitung — iconic rare encounters
  { id:3, name:'Vermilion / Power Plant',type:'electric',leader:'Lt. Surge',min:15, level:21,
    pool:[100,50,84,96,111,37,116,86,63],                                   // Voltorb, Diglett, Doduo, Drowzee, Rhyhorn, Vulpix, Horsea, Seel, Abra
    rares:[147, 115, 123] },                                                // Dratini, Kangaskhan, Scyther — Safari Zone classics
  { id:4, name:'Celadon / Lavender',type:'grass',    leader:'Erika',    min:22, level:28,
    pool:[114,102,92,43,104,137,58,72,56] },                                // Tangela, Exeggcute, Gastly, Oddish, Cubone, Porygon, Growlithe, Tentacool, Mankey
                                                                            // Z4 has no rares — middle zone, no inverse pair.
  { id:5, name:'Fuchsia / Safari Zone',type:'poison',leader:'Koga',     min:29, level:35,
    pool:[88,109,32,128,115,127,123,35,147],                                // Grimer, Koffing, NidoranM, Tauros, Kangaskhan, Pinsir, Scyther, Clefairy, Dratini
    rares:[100, 111, 63] },                                                 // Voltorb (→Electrode), Rhyhorn, Abra (→Kadabra/Alakazam) — Power Plant + Safari overlap
  { id:6, name:'Saffron / Dojo',   type:'psychic',   leader:'Sabrina',  min:36, level:42,
    pool:[122,106,107,124,79,108,113,143,81],                               // Mr.Mime, Hitmonlee, Hitmonchan, Jynx, Slowpoke, Lickitung, Chansey, Snorlax, Magnemite
    rares:[129, 54, 66] },                                                  // Magikarp (→Gyarados), Psyduck (→Golduck), Machop (→Machoke/Machamp)
  { id:7, name:'Cinnabar / Pokémon Mansion',type:'fire',leader:'Blaine',min:43, level:49,
    pool:[126,132,138,142,131,98,90,125],                                   // Magmar, Ditto, Omanyte, Aerodactyl, Lapras, Krabby, Shellder, Electabuzz
    rares:[16, 74, 69] },                                                   // Pidgey (→Pidgeot), Geodude (→Golem), Bellsprout (→Victreebel) — late-game evolutions of Z1 starters
];

// Trainer archetypes per zone. Each entry has a primary `type` (internal), a `sprite` slug
// (Pokémon Showdown trainer image filename — modern art where available), a Pokémon pool, and
// a roster `size`. Sizes scale with zone: Z1=2, Z2=3, Z3=4, Z4+=5. Pools always contain at
// least `size` species so the slice in startTrainerBattle pulls a full team.
// Each zone has at least 5 distinct trainer archetypes; an in-run "seen" list (state.seenTrainers)
// guarantees no repeat encounters until the player advances to the next zone.
// Pool order = placement order — see startTrainerBattle's TRAINER_LAYOUTS for the
// per-size slot mapping. First entry is the most "front" Pokémon (tank), last is back.
// Rationale per slot: tank front to absorb hits; damage dealers behind same-col tanks;
// turn-based passives in back where they survive long enough to fire; adjacency abilities
// (tailwind/healer/helpingHand) placed so the buff lands on an actual ally.
export const TRAINERS = {
  1: [ // Layout [F2, B2]
    { name:'Youngster',   type:'normal', sprite:'youngster',     pool:[16, 19],         size:2 }, // Pidgey (tank w/ tailwind), Rattata (back damage)
    { name:'Bug Catcher', type:'bug',    sprite:'bugcatcher',    pool:[10, 13],         size:2 }, // Caterpie (shedSkin), Weedle (poison contact)
    { name:'Lass',        type:'normal', sprite:'lass',          pool:[16, 37],         size:2 }, // Jigglypuff (115 HP tank), Vulpix (back willOWisp)
    { name:'Hiker',       type:'rock',   sprite:'hiker',         pool:[74, 74],         size:2 }, // Geodude, Geodude
    { name:'Camper',      type:'normal', sprite:'camper',        pool:[46, 21],         size:2 }, // Paras (tank w/ stun spores), Spearow (back sniper)
  ],
  2: [ // Layout [F2, B2]
    { name:'Swimmer',     type:'water',  sprite:'swimmer-gen1',  pool:[118, 60],        size:2 }, // Goldeen (predatorsMark front), Poliwag (back waterVeil)
    { name:'Fisherman',   type:'water',  sprite:'fisherman',     pool:[129, 129],       size:2 }, // Magikarp, Magikarp
    { name:'Hiker',       type:'rock',   sprite:'hiker',         pool:[95, 74],         size:2 }, // Onix (160 HP tank), Geodude (back rocky helmet)
    { name:'Bird Keeper', type:'flying', sprite:'birdkeeper',    pool:[16, 21],         size:2 }, // Pidgey (front tailwind), Spearow (back sniper)
    { name:'Lass',        type:'normal', sprite:'lass',          pool:[35, 43],         size:2 }, // Clefairy (healer front), Oddish (back SPD ramp)
  ],
  3: [ // Layout [F1, F2, B2]
    { name:'Sailor',      type:'fighting', sprite:'sailor',      pool:[72, 118, 98],    size:3 }, // Tentacool (passive poison front), Goldeen (predatorsMark mid), Krabby (back guillotine)
    { name:'Engineer',    type:'electric', sprite:'engineer-gen1', pool:[29, 81, 81],   size:3 }, // NidoranF (stamina regen tank), Magnemite (magnetPull), Magnemite (back)
    { name:'Rocker',      type:'electric', sprite:'rocker-gen1', pool:[100, 100, 100],  size:3 }, // Voltorb × 3
    { name:'Bird Keeper', type:'flying',   sprite:'birdkeeper',  pool:[22, 17, 84],     size:3 }, // Fearow (sniper tank), Pidgeotto (F2 tailwind buffs F1 Fearow), Doduo (back earlyBird)
    { name:'Gambler',     type:'electric', sprite:'gambler-gen1',pool:[96, 25, 100],    size:3 }, // Drowzee (hypnosis tank), Pikachu (mid static), Voltorb (back rollout)
  ],
  4: [ // Layout [F1, F2, B2]
    { name:'Beauty',      type:'grass',  sprite:'beauty',        pool:[114, 69, 43],    size:3 }, // Tangela (100 ATK front, constrict slow), Bellsprout (gluttony heal), Oddish (back SPD ramp)
    { name:'Channeler',   type:'ghost',  sprite:'channeler-gen1',pool:[93, 93, 93],     size:3 }, // Haunter × 3
    { name:'Pokémaniac',  type:'ground', sprite:'pokemaniac-gen1',pool:[79, 104, 108],  size:3 }, // Slowpoke (90 HP yawn tank), Cubone (battleArmor row aura at F2), Lickitung (back cloudNine stun)
    { name:'Burglar',     type:'fire',   sprite:'burglar-gen1',  pool:[58, 37, 52],     size:3 }, // Growlithe (65 HP moxie tank), Vulpix (mid willOWisp), Meowth (back pickup)
    { name:'Hiker',       type:'rock',   sprite:'hiker',         pool:[95, 74, 27],     size:3 }, // Onix (mega tank), Geodude (mid rocky helmet), Sandshrew (back sandVeil)
  ],
  5: [ // Layout [F1, F2, B1, B2]
    { name:'Rocket Grunt',type:'poison',   sprite:'teamrocket',  pool:[88, 23, 109, 41], size:4 }, // Grimer (80 HP pungentAura taunt), Ekans→Arbok (coil), Koffing→Weezing (back aftermath), Zubat→Golbat (back echolocation)
    { name:'Juggler',     type:'psychic',  sprite:'juggler-gen1',pool:[113, 40, 97, 122], size:4 }, // Chansey (250 HP naturalCure), Wigglytuff (140 HP lullaby), Hypno (back hypnosis), Mr.Mime (back mimic)
    { name:'Tamer',       type:'normal',   sprite:'tamer-gen1',  pool:[115, 128, 28, 53], size:4 }, // Kangaskhan (105 HP parental bond), Tauros (105 HP trample), Sandslash (back sandVeil), Persian (back fast atk)
    { name:'Black Belt',  type:'fighting', sprite:'blackbelt',   pool:[66, 106, 56, 107], size:4 }, // Machop→Machoke (crit), Hitmonlee (limber back-row hunter), Mankey→Primeape (back vitalSpirit), Hitmonchan (back ironFist)
    { name:'Bird Keeper', type:'flying',   sprite:'birdkeeper',  pool:[17, 84, 22, 41],   size:4 }, // Pidgeotto (F1 tailwind buffs F2 Dodrio), Doduo→Dodrio (front earlyBird), Spearow→Fearow (back sniper), Zubat→Golbat (back echolocation)
  ],
  6: [ // Layout [F1, F2, B1, B2]
    { name:'Psychic',     type:'psychic',  sprite:'psychic',     pool:[79, 96, 63, 122],  size:4 }, // Slowpoke→Slowbro (110 HP yawn), Drowzee→Hypno (90 HP stun), Abra→Alakazam (back magicGuard), Mr.Mime (back mimic)
    { name:'Black Belt',  type:'fighting', sprite:'blackbelt',   pool:[67, 56, 106, 107], size:4 }, // Machoke→Machamp (crit tank), Mankey→Primeape (vitalSpirit), Hitmonlee (back-row hunter), Hitmonchan (back ironFist)
    { name:'Juggler',     type:'psychic',  sprite:'juggler-gen1',pool:[124, 96, 122, 100], size:4 }, // Jynx (95 HP disrupt), Drowzee→Hypno (90 HP stun), Mr.Mime (back mimic), Voltorb→Electrode (back rollout)
    { name:'Cooltrainer', type:'fighting', sprite:'acetrainer',  pool:[80, 68, 65, 124],  size:4 }, // Slowbro (110 HP yawn), Machamp (100 HP crit), Alakazam (back magicGuard), Jynx (back disrupt)
    { name:'Beauty',      type:'psychic',  sprite:'beauty',      pool:[80, 36, 124, 122], size:4 }, // Slowbro (110 HP tank), Clefable (F2 healer reaches F1 Slowbro), Jynx (back disrupt), Mr.Mime (back mimic)
  ],
  7: [ // Layout [F1, F2, B1, B2]
    { name:'Burglar',     type:'fire',     sprite:'burglar-gen1',pool:[58, 126, 37, 52],  size:4 }, // Growlithe→Arcanine (100 HP moxie), Magmar (75 HP flameBody contact), Vulpix→Ninetales (back willOWisp), Meowth→Persian (back fast)
    { name:'Super Nerd',  type:'normal',   sprite:'scientist',   pool:[126, 132, 137, 100], size:4 }, // Magmar (flameBody front), Ditto (F2 imposter copies Magmar), Porygon (back column explosion), Voltorb→Electrode (back rollout)
    { name:'Bird Keeper', type:'flying',   sprite:'birdkeeper',  pool:[142, 18, 21, 84],  size:4 }, // Aerodactyl (80 HP skyHigh tank), Pidgeot (83 HP tailwind buffs F1 Aero), Spearow→Fearow (back sniper), Doduo→Dodrio (back earlyBird)
    { name:'Cooltrainer', type:'fire',     sprite:'acetrainer',  pool:[143, 59, 6, 38],   size:4 }, // Snorlax (160 HP thickFat), Arcanine (100 HP moxie), Charizard (back blaze), Ninetales (back willOWisp)
    { name:'Gambler',     type:'fire',     sprite:'gambler-gen1',pool:[58, 132, 137, 38], size:4 }, // Growlithe→Arcanine (front), Ditto (F2 imposter copies Arcanine), Porygon (back explosion), Ninetales (back burn)
  ],
};

// Gym leader teams (canon Gen 1, scaled to zone level via TEAMS levels)
// Each entry: { species_id, level_offset (added to zone level) }
// Roster sizes mirror the per-zone trainer scaling: Brock 2, Misty 3, Lt. Surge 4,
// Erika+ all 5. Each leader's roster has NO duplicate species ids, accounting for
// auto-evolution at the zone level (so e.g. Koga doesn't secretly end up with three
// Weezings via Koffing→Weezing at lvl 40).
export const GYM_LEADERS = {
  Brock:     { name:'Brock',     pool:[ {id:74, lvl:0}, {id:111, lvl:2} ] },                                                         // Geodude, Rhyhorn
  Misty:     { name:'Misty',     pool:[ {id:118, lvl:0}, {id:116, lvl:0}, {id:119, lvl:4} ] },                                       // Goldeen, Horsea, Seaking
  'Lt. Surge':{ name:'Lt. Surge',pool:[ {id:25, lvl:0}, {id:100, lvl:0}, {id:81, lvl:2}, {id:26, lvl:4} ] },                         // Pikachu, Voltorb, Magnemite, Raichu
  Erika:     { name:'Erika',     pool:[ {id:69, lvl:0}, {id:43, lvl:0}, {id:114, lvl:0}, {id:45, lvl:2}, {id:103, lvl:4} ] },        // Bellsprout(→Weepinbell), Oddish(→Gloom), Tangela, Vileplume, Exeggutor
  Koga:      { name:'Koga',      pool:[ {id:110, lvl:0}, {id:89, lvl:0}, {id:42, lvl:0}, {id:24, lvl:0}, {id:34, lvl:2} ] },         // Weezing, Muk, Golbat, Arbok, Nidoking
  Sabrina:   { name:'Sabrina',   pool:[ {id:122, lvl:0}, {id:97, lvl:0}, {id:124, lvl:0}, {id:80, lvl:0}, {id:65, lvl:4} ] },        // Mr.Mime, Hypno, Jynx, Slowbro, Alakazam
  Blaine:    { name:'Blaine',    pool:[ {id:38, lvl:0}, {id:126, lvl:0}, {id:132, lvl:0}, {id:59, lvl:2}, {id:6, lvl:4} ] },         // Ninetales, Magmar, Ditto, Arcanine, Charizard
};

// ─── Run parameters ───────────────────────────────────────────────────────
// Adventure structure (rewritten): each zone is 9 steps in 3 sets of 3, with the
// step type determined by `advStep % 3`:
//   0 → Capture step  (pick 1 of 2 wild Pokémon, or skip for 2 small berries)
//   1 → Trainer step  (pick normal trainer, hard trainer, or skip for 2 small berries)
//   2 → Special step  (pick 1 of 2 distinct special events)
// After 9 steps the zone proceeds to its gym leader / PvP boss as before.
export const RUN = {
  startingMoney: 0,
  startingStrikes: 3,
  badgesToWin: 5,
  totalRounds: 7,
  starterLevel: 5,
  starterPool: [1, 4, 7, 25, 52, 39, 133, 29, 104],   // Bulbasaur, Charmander, Squirtle, Pikachu, Meowth, Jigglypuff, Eevee, NidoranF, Cubone
  starterChoices: 3,
  adventureSteps: 9,
  teamSize: 6,
  itemSlots: 3,
  jobReward: 500,
  daycareLevels: 6,
  trainerWinMoney: 300,
  berrySellMoney: 300,            // full-size berries; small berries hardcode to $100 at the sell site
  // New step constants ─────────────────────────────────────────────────
  captureSkipBerryCount: 2,           // small berries dropped when you Skip the capture step
  trainerSkipBerryCount: 2,           // same for the trainer-skip "Pick small berries" option
  trainerWinLevels: { normal: 1, hard: 2 },  // team-level reward per trainer difficulty
  hardTrainerLevelPerZone: 1,         // hard adds +N levels to each enemy, scaled by zone
  hardTrainerExtraPokemon: 1,         // hard trainer brings +1 Pokémon (capped at teamSize=6)
  wildHordeLevels: 1,                 // team-level reward on horde win (was 3)
  // Capture-step rare-species chance. Each rare in the current zone's `rares` list
  // independently rolls against this on every wild slot — 3 rares × 1% = ~3% per
  // slot, ~6% per step. Rare picks always use the same zone-level scaling as a
  // normal pool pick, so a Z1 rare like Pidgey shows at L5 while a Z7 rare like
  // Geodude shows at L43+ (Golem). Lowering this number makes rares feel like
  // genuine surprises; raising it makes them a more reliable progression tool.
  rareWildChance: 0.01,
  // Shiny chance — applied on every Pokémon instance the player can OWN (wild
  // captures, trade offers, starter picks). Trainer rosters never roll shiny.
  // A shiny is purely cosmetic + a flat +15% boost to base hp/atk/spd (the boost
  // applies post-actualStats so it follows through level-ups and evolutions).
  shinyChance: 1 / 500,
  shinyStatMultiplier: 1.15,
  // Save format version — bumped when the in-flight run shape changes meaningfully.
  // Saves with a lower version are wiped on load so the player gets a clean start
  // rather than crashing on a stale `pendingEvents` shape.
  saveFormatVersion: 2,
};

// ─── Rank tiers ──────────────────────────────────────────────────────────
export const RANKS = ['Poké', 'Great', 'Ultra', 'Master'];
export function rankFromElo(elo) {
  // 16 ranks total: 0–199 = Poké 1, 200–399 = Poké 2, ..., 3000+ = Master 4
  const i = Math.min(15, Math.max(0, Math.floor(elo / 200)));
  return { tier: RANKS[Math.floor(i / 4)], sub: (i % 4) + 1 };
}
