# PokeMini — Abilities

One ability per evolutionary line. Evolutions inherit the same ability with stronger numbers. Format:

> **Ability Name** (Trigger) — *Stage 1 / Stage 2 / Stage 3*

Where only one or two stages exist, only those slots are filled. Numbers below are first-pass and **subject to balance**. All percentages are stackable unless noted.

---

## Starters

### Bulbasaur → Ivysaur → Venusaur
**Overgrowth** (OnTurnEnd) — At the end of each turn, this Pokémon heals **5% / 10% / 15%** of its max HP. *Inspired by* Overgrow + Synthesis.

### Charmander → Charmeleon → Charizard
**Blaze** (OnAttack) — When this Pokémon attacks, **always** applies **Burn 2 / Burn 4 / Burn 8** to the target. Burn stacks (see Status Effects below). *Inspired by* Blaze + Flamethrower.

### Squirtle → Wartortle → Blastoise
**Shell Bash** (OnHit, stacking) — Each time this Pokémon is hit, the shell hardens and grants a permanent **+3% / +5% / +8%** damage reduction. Reductions stack additively and cap at 50% total. New stacks apply to subsequent hits — the hit that grants the stack itself is not reduced. *Inspired by* Withdraw + Shell Smash (reversed).

### Pikachu → Raichu
**Static** (OnAttack) — Each attack has a **30% / 50%** chance to apply **Stun 1** to the target. *Inspired by* Static. (All attacks are treated equally — the game does not distinguish melee from ranged.)

### Eevee → Vaporeon
**Adaptability / Water Absorb** — Eevee always evolves into **Vaporeon** (decision #1).
- **Eevee — Adaptability** (OnBattleStart): copies the ability of the **ally immediately to its right** (next column over, same row) for the duration of the battle. If there is no Pokémon to the right (Eevee is in column 3, or the right-neighbor slot is empty), Adaptability does nothing.
- **Vaporeon — Water Absorb** (OnHit): if hit by a Water-type attacker, heal **25%** max HP instead of taking damage.

### Meowth → Persian
**Pickup** (OnBattleWin) — Whenever the player wins a battle (Trainer Battle or PvP) with this Pokémon on the team, gain **100 / 200** bonus money. Triggers regardless of whether Meowth/Persian was alive at the end, dealt damage, or scored any KO — being on the roster is enough. *Inspired by* Pickup + Pay Day.

### Jigglypuff → Wigglytuff
**Lullaby** (OnBattleStart) — Applies **Stun 2 / Stun 3** to a random enemy. *Inspired by* Sing.

---

## Route 1 — Normal & Flying

### Pidgey → Pidgeotto → Pidgeot
**Tailwind** (OnTurnEnd) — At the end of each turn, raises the ATK of **horizontally adjacent allies** (same row, neighbouring columns) by **+2% / +4% / +5%**. Stacks each turn for the rest of the battle. Does not buff itself. *Inspired by* Tailwind + Featherdance.

### Rattata → Raticate
**Run Away** (OnHit, once) — The first time this Pokémon is reduced below 30% HP, it **swaps positions with the Pokémon directly behind it** (same column, back row) — the back-row ally moves up to the front, this Pokémon retreats to the back. If the back-row slot is empty, it simply moves back. If this Pokémon is already in the back row, no movement happens. Either way, it gains **+20% / +35% ATK** for the rest of the battle. *Inspired by* Run Away + Hustle.

### Spearow → Fearow
**Sniper** (OnAttack) — Critical hits deal **3× / 4×** damage instead of 2×, and crit rate is doubled. *Inspired by* Sniper + Drill Peck.

---

## Viridian Forest — Bug

### Caterpie → Metapod → Butterfree
**Shed Skin** (OnFaint, once) — The first time this Pokémon faints, it revives at **25% / 40% / 55%** HP. *Inspired by* Shed Skin + Compound Eyes.

### Weedle → Kakuna → Beedrill
**Poison Point** (OnAttack) — When this Pokémon attacks, **always** applies **Poison 1 / Poison 2 / Poison 3** to the target. Poison stacks (see Status Effects). The Weedle line is the canonical Poison applier — guaranteed application every attack, scaling % damage per turn. *Inspired by* Poison Point.

### Oddish → Gloom → Vileplume
**Chlorophyll** (OnTurnEnd) — Gain **+5% / +8% / +12% SPD** at the end of each turn (no cap). *Inspired by* Chlorophyll.

### Bellsprout → Weepinbell → Victreebel
**Gluttony** (OnEnemyFaint) — Whenever **any** enemy Pokémon faints (whether or not this Pokémon dealt the killing blow), heal **10% / 20% / 30%** max HP. Triggers once per enemy faint event. *Inspired by* Gluttony.

---

## Mt. Moon — Rock & Normal

### Geodude → Graveler → Golem
**Rocky Helmet** (OnHit) — Whenever this Pokémon takes damage from an attack, reflect **15% / 30% / 45%** of that damage back to the attacker. Reflected damage does not chain (it cannot retrigger the attacker's own Rocky Helmet). *Inspired by* Rocky Helmet + Rough Skin.

### Zubat → Golbat
**Echolocation** (OnTurnStart) — At the start of each turn, every enemy on the field (all 6 slots, front + back) gains a stacking **+2% / +4%** chance to miss on their attacks for the rest of the battle. The miss roll happens on each enemy's attack and replaces normal damage with a logged dodge. *Inspired by* Supersonic + Confuse Ray.

### Clefairy → Clefable
**Healer** (OnTurnEnd) — At the end of each turn, heal all **horizontally adjacent allies** (same row, neighbouring columns) by **8% / 15%** of their max HP. A Clefairy in column 2 heals two allies (columns 1 and 3); in column 1 or 3, it heals one. Does not heal itself. *Inspired by* Healer + Moonlight + Heal Pulse.

### Paras → Parasect
**Effect Spore** (OnHit) — **25% / 50%** chance to apply **Stun 1 / Stun 2** to the attacker. (Poison roll dropped — stuns only.) *Inspired by* Effect Spore.

---

## Cerulean Coast — Water

### Magikarp → Gyarados
**Intimidate** (OnBattleStart) — Lower **ATK by 5% / 50%** of the enemy front-row Pokémon in this Pokémon's column. Magikarp's version is intentionally weak (joke ability — decision #10); the line's full power comes online on evolution. Intimidate is **exclusive** to this line — no other line shares it.

### Psyduck → Golduck
**Damp** (OnBattleStart, pre-pass) — Permanently disables the ability of the enemy directly across from this Pokémon (same column, front row) for the entire battle. **Golduck** also disables the back-row Pokémon in that same column. The disable is applied as a pre-pass *before* the rest of `onBattleStart` runs, so the target's own battle-start ability never fires (their `abilityId` is nulled). All subsequent `target.abilityId === '…'` checks throughout the engine — offensive, defensive, on-faint, on-turn-start/end — short-circuit naturally. Fully deterministic — no RNG. Subject to Jynx's Disrupt (which blocks every onBattleStart ability including Damp). *Inspired by* Damp + Cloud Nine.

### Poliwag → Poliwhirl → Poliwrath
**Water Veil** (Passive) — While at or above 75% HP, gain **+10% / +20% / +30% ATK**. *Inspired by* Water Veil.

### Tentacool → Tentacruel
**Toxic Sweat** (OnTurnEnd) — At the end of each turn, apply **Poison 1 / Poison 2** to a random alive enemy. Passive poison spread that does not depend on attacking — Tentacool's contribution is felt even from the back row. *Inspired by* Poison Touch + Liquid Ooze.

### Shellder → Cloyster
**Withdraw** (Passive) — Takes **15% / 30%** less damage from all attacks. *Inspired by* Withdraw + Shell Armor.

### Krabby → Kingler
**Guillotine** (OnAttack) — Each attack against an enemy below **50% HP** has a **20% / 40%** chance to instantly KO it (overrides the damage roll with damage = remaining HP). *Inspired by* Guillotine.

### Goldeen → Seaking
**Predator's Mark** (OnBattleStart) — All enemies start the battle with **5% / 10%** less max HP (current HP is reduced proportionally — even if they heal later, they cap at the reduced max). Applies to all 6 enemy slots. *Inspired by* Horn Attack + Pressure.

### Horsea → Seadra
**Toxic Spike** (OnHit) — **25% / 40%** chance to apply **Poison 2 / Poison 3** to the attacker. Poison stacks (see Status Effects).

---

## Rock Tunnel — Rock, Ground, Fighting

### Onix (no evolution in Gen 1)
**Rock Head** (Passive) — Immune to all status effects (**Burn, Poison, Stun**, and any future statuses). Existing status effects on this Pokémon are cleared at battle start.

### Cubone → Marowak
**Battle Armor** (Passive) — All allies in the same horizontal line as this Pokémon (the front 3 or the back 3, depending on where it stands — up to 3 allies including itself) take **8% / 15%** less damage from attacks. Line-wide protective aura. *Inspired by* Battle Armor + Thick Club.

### Diglett → Dugtrio
**Arena Trap** (OnBattleStart) — Reduces the SPD of all enemy back-row Pokémon by **10% / 20%** for the rest of the battle. *Inspired by* Arena Trap.

### Machop → Machoke → Machamp
**Cross Chop** (OnAttack) — Each attack has **30% / 45% / 60%** chance to land as a **critical hit** (deals 2× damage). Replaces the baseline 5% crit chance for this Pokémon's attacks. *Inspired by* Cross Chop + Karate Chop.

---

## Pokémon Tower — Ghost, Poison, Psychic

### Gastly → Haunter → Gengar
**Hex** (OnAttack) — Attacks deal **+30% / +50% / +70%** bonus damage against any target suffering a status (Burn, Poison, or Stun). Pairs aggressively with teammates that apply status (Weedle/Vulpix/Pikachu). *Inspired by* Hex.

### Drowzee → Hypno
**Hypnosis** (OnTurnStart) — At the start of every odd-numbered turn, applies **Stun 1 / Stun 2** to a random alive enemy. *Inspired by* Insomnia + Hypnosis.

### Grimer → Muk
**Pungent Aura** (Passive) — Forces **all 6 enemy** Pokémon (front and back) to target this Pokémon first, overriding the normal frontline-first targeting rules (§7.3). Same effect for both stages — Grimer and Muk are equally insufferable. While Pungent Aura is active and this Pokémon is alive, every enemy skips its usual target and attacks this Pokémon, even if it sits in the back row.

**Multiple Pungent Aura Pokémon on the same team:** each enemy picks one of the alive Pungent Aura sources **at random per attack** (uniform distribution). When one source faints, the remaining sources continue to soak aggression.

*Inspired by* Stench (canon) reinterpreted as a taunt.

### Koffing → Weezing
**Aftermath** (OnFaint) — Deal **30% / 50%** of this Pokémon's max HP as damage to the attacker that KO'd it. *Inspired by* Aftermath.

---

## Victory Road — Mixed Elite

### Lickitung (no evolution in Gen 1)
**Cloud Nine** (OnBattleStart) — Applies **Stun 3** to the enemy in this Pokémon's column. Targets the front-row enemy first; if that slot is empty, targets the back-row enemy instead. *Inspired by* canon Cloud Nine reimagined as a haze.

### Snorlax (no evolution in Gen 1)
**Thick Fat** (Passive) — Starts the battle with **+30%** to its base max HP (and current HP). No damage reduction; pure stat buff.

### Tauros (no evolution in Gen 1)
**Trample** (OnAttack) — When this Pokémon attacks an enemy in the **front row**, the enemy back-row Pokémon in the **same column** also takes **20%** of the damage dealt. The pierce damage does not retrigger OnHit abilities on the back-row target (no Rocky Helmet bounce-back, no Static proc).

### Kangaskhan (no evolution in Gen 1)
**Parental Bond** (OnAttack) — Every attack hits twice; **each hit deals 60%** of normal damage (total per turn: 120%). Both hits resolve OnHit triggers on the target. *Inspired by* Parental Bond.

### Aerodactyl (rare in Gen 1)
**Sky High** (OnBattleStart) — For the **first 2 turns** of the battle, this Pokémon cannot be targeted by any enemy attack or ability. Effectively skips it as a valid target for those turns (enemies target whoever is next-priority). After 2 turns, Aerodactyl becomes targetable normally. Pungent Aura overrides Sky High — a tank's taunt still pulls aggression through. *Inspired by* Sky Drop + Fly.

---

## Additional Pokémon (Distributed Across Zones)

The lines below were previously authored as trainer-only fillers. They are now part of the wild-encounter pool for one of the 7 zones — see `GDD.md §6.5` for the canonical zone assignment of each line. They remain valid trainer-team picks too.

### Ekans → Arbok
**Coil** (OnAttack) — Each time this Pokémon attacks, it gains **+5% / +10% ATK** for the rest of the battle. Stacks per attack. The snake winds itself tighter with every strike.

### Sandshrew → Sandslash
**Sand Veil** (OnHit) — **20% / 40%** chance to take 0 damage from an incoming attack.

### Nidoran♀ → Nidorina → Nidoqueen
**Stamina** (OnAllyHit) — Each time **any ally (including itself)** is hit by an enemy attack, this Pokémon gains **+2% / +4% / +5%** to its max HP **and** current HP. Stacks per hit. A team protector that grows tougher as the team takes punishment.

### Nidoran♂ → Nidorino → Nidoking
**Rivalry** (OnAllyHit) — Each time **any ally (including itself)** is hit by an enemy attack, this Pokémon gains **+2% / +4% / +5% ATK** for the rest of the battle. Stacks per hit. A team avenger — the more the team takes hits, the harder Nidoking strikes back.

### Vulpix → Ninetales
**Will-O-Wisp** (OnTurnStart) — At the start of every turn, applies **Burn 3 / Burn 5** to a random alive enemy in the **back row**. If no back-row enemies are alive that turn, the application is wasted.

### Mankey → Primeape
**Vital Spirit** (Passive) — While below 50% HP, gain **+25% / +50% ATK**.

### Growlithe → Arcanine
**Moxie** (OnKO) — Each time this Pokémon defeats an enemy, gain **+15% / +30% ATK** for the rest of the battle. Stacks per KO. *Inspired by* Moxie.

### Abra → Kadabra → Alakazam
**Magic Guard** (Passive) — Immune to all non-direct-attack damage sources (poison, burn, reflect, Aftermath).

### Slowpoke → Slowbro
**Yawn** (OnTurnEnd) — At the end of turn **5 / 4**, instantly KOs a random alive enemy. One-time per battle. If this Pokémon faints before its trigger turn, Yawn does not fire. *Inspired by* Yawn + Slack Off.

### Magnemite → Magneton
**Magnet Pull** (OnBattleStart) — At the start of battle, forcibly swaps the front-row and back-row Pokémon of **1 / 2** randomly chosen enemy columns. Each swap exposes a back-row Pokémon to frontline targeting. Empty slots in a chosen column count as a wasted swap.

### Doduo → Dodrio
**Early Bird** (Passive — turn order override) — This Pokémon always acts **first** every turn, regardless of SPD. If multiple Pokémon (across both teams) have Early Bird, their order among themselves is randomized each turn from a shared seed. All non-Early-Bird Pokémon then act in normal SPD order after the Early Birds.

### Seel → Dewgong
**Rest** (Triggered, once per battle) — The first time this Pokémon's current HP drops below **50%**, it instantly restores to **full HP** and is **Stunned for 3 turns** (same value for both stages). During the Stun, this Pokémon's ability is dormant (per the global rule that Stunned Pokémon have no ability triggers) — so Rest cannot loop. After the Stun expires, Rest **cannot re-trigger** this battle. The Pokémon is still mortal: enough incoming damage during the Stun window can KO it before it wakes. *Inspired by* Rest.

### Voltorb → Electrode
**Rollout** (OnAttack) — Each attack deals an additional **10% / 20% of this Pokémon's SPD** as flat damage to the target. The faster Voltorb spins, the harder it hits. *Inspired by* Rollout + speed-scaling.

### Exeggcute → Exeggutor
**Solar Beam** (OnTurnEnd) — At the end of turn **3 / 2**, fires a charged Solar Beam at a random alive enemy, dealing **300%** of this Pokémon's ATK as damage. Single-use per battle. If this Pokémon faints before its trigger turn, Solar Beam does not fire.

### Hitmonlee
**Limber** (Passive — targeting override) — This Pokémon's attacks target the enemy **back row first**, skipping the frontline-first rule (§7.3). If the enemy back row is fully empty, falls back to normal front-row targeting. Pungent Aura still overrides Limber — a taunt outranks Limber's targeting bypass.

### Hitmonchan
**Iron Fist** (OnAttack) — Every 3rd attack deals **+50%** damage.

### Chansey
**Natural Cure** (OnTurnEnd) — Removes all status effects from a random **statused** ally (including itself). The target is chosen uniformly from the set of allies currently affected by at least one status (Stun, Burn, or Poison). If no ally is statused, Natural Cure does nothing that turn.

### Tangela
**Constrict** (OnAttack) — Each attack permanently reduces the target's SPD by **15%** for the rest of the battle. Stacks on the same target per attack. Vines tighten with every hit.

### Mr. Mime
**Mimic** (OnBattleStart) — Copies the ability of the enemy in this Pokémon's column for the rest of the battle. Targets the front-row enemy first; if that slot is empty, targets the back-row enemy in the same column. If the entire opposing column is empty, Mimic has no effect. *Inspired by* Mimic.

### Scyther
**Predator** (OnAttack) — Deals **+30%** damage to enemies currently below **50% HP**.

### Jynx
**Disrupt** (OnBattleStart, priority) — Jynx's Disrupt fires first, before any other OnBattleStart abilities resolve. It then **disables all other OnBattleStart abilities on both teams** for the rest of the battle. Lullaby, Damp, Cloud Nine, Mimic, Predator's Mark, Whale Song, Magnet Pull, Sky High, Quick Charge, Imposter, Disrupt itself on any other Jynx — all suppressed when Jynx is present. Jynx's own Disrupt is the only OnBattleStart effect that resolved before the suppression.

### Electabuzz
**Discharge** (OnAttack) — Each attack also deals **10%** of the damage to all **other enemies in the same row as the primary target** (the other 2 enemies in that horizontal line — front 3 or back 3). Chain damage does not retrigger OnHit abilities on the splash targets.

### Magmar
**Flame Body** (OnHit) — Always applies **Burn 3** to the attacker. Burn stacks (see Status Effects).

### Pinsir
**Vice Grip** (OnAttack) — Each attack permanently reduces the target's **ATK by 15%** for the rest of the battle. Stacks on the same target per attack. Crushing pincers gradually disable the prey.

### Lapras
**Whale Song** (OnTurnEnd) — At the end of turn **3**, heals all allies (including itself) by **15%** of their max HP. Single-use per battle. If Lapras faints before turn 3 ends, Whale Song does not fire.

### Ditto
**Imposter** (OnBattleStart) — Copies the species, type, stats, and ability of the **ally immediately to the left** (same row, previous column) for the rest of the battle. If Ditto is in column 1 (leftmost) or the left-neighbour slot is empty, Imposter has no effect.

### Porygon
**Explosion** (OnBattleStart) — At the start of battle, this Pokémon **self-faints** and instantly KOs the enemy in the **opposing front-row position** (same column). If the opposing front-row slot is empty, Porygon still self-faints but the KO is wasted. *Inspired by* Explosion + Self-Destruct.

### Omanyte → Omastar
**Spiral Shell** (OnHit + OnAttack) — Each time this Pokémon is hit, its shell stores a charge. The next outgoing attack consumes the charge and deals **+25% / +40%** bonus damage. Multiple hits before an attack keep the charge active but do not stack — one stored counter-strike at a time.

### Kabuto → Kabutops
**Mega Drain** (OnAttack) — Each attack heals this Pokémon by **25% / 40%** of the damage dealt to the target. Pure lifesteal — sustains itself by dealing damage. *Inspired by* Mega Drain + Leech Life.

### Dratini → Dragonair → Dragonite
**Marvel Scale** (Passive) — While suffering from any status, takes **−25% / −35% / −50%** damage. *Inspired by* Marvel Scale.

---

## Status Effects

Each affected Pokémon carries a per-status state. Multiple statuses can coexist on the same target.

### Burn (stackable counter)

- A burned Pokémon has a single integer value **X ≥ 1**.
- At the **end of each turn**, the burned Pokémon takes **X − 1** damage. Then **X decrements by 1**.
- When **X reaches 0**, Burn is cleared.
- **Stacking**: applying *Burn N* to a target with existing *Burn M* sets the value to **M + N** (no separate stacks tracked; one counter per target).

Burn damage over time (no further applications):

| Initial X | Damage by turn | Total |
|---|---|---|
| 2 | 1, 0 | 1 |
| 3 | 2, 1, 0 | 3 |
| 4 | 3, 2, 1, 0 | 6 |
| 8 | 7, 6, 5, 4, 3, 2, 1, 0 | 28 |

In practice, repeated applications from a surviving attacker (e.g., Charmander attacking every turn) make Burn snowball: the counter grows by **(application − 1)** each round it's applied, because the −1 decay is cancelled by the new application's +1 effective increment. A Charmander attacking each round nets +1 X per round; Charizard nets +7 per round.

### Poison (stackable counter, % of max HP)

- A poisoned Pokémon has a single integer value **Y ≥ 1**.
- At the **end of each turn**, the poisoned Pokémon takes **Y%** of its max HP as damage. The counter **does NOT decay** — it stays at Y for the rest of the battle (or until the target faints).
- **Stacking**: applying *Poison N* to a target with existing *Poison M* sets the value to **M + N**.

Unlike Burn (which decays one tick per turn), Poison is a permanent DoT for the duration of the battle. A target with Poison 3 will lose 3% of its max HP every turn forever.

Poison damage over time (no further applications):

| Initial Y | Damage by turn (% max HP) | After 5 turns | After 10 turns |
|---|---|---|---|
| 1 | 1, 1, 1, 1, 1, … | 5% | 10% |
| 2 | 2, 2, 2, 2, 2, … | 10% | 20% |
| 3 | 3, 3, 3, 3, 3, … | 15% | 30% |

Repeated applications from a surviving attacker compound the per-turn tick: a Beedrill attacking each round adds +3 Y per round, so by round 5 the target is eating ~15 × 5 = 75% max HP across those turns from one Beedrill alone. The Weedle line remains the late-game DoT specialist — even more dominant now that the stack never falls off.

### Stun (unified skip-action status)

All skip-action statuses have been merged under one name: **Stun**. Sleep, Paralysis, Charm, and any other "you lose your action" mechanic in this game are all Stun with a duration.

- **Stun N**: the target skips its action for the next **N** turns.
- **Does not break on hit** — Stunned Pokémon serve out the full duration regardless of incoming damage.
- **Ability suppression**: while a Pokémon is Stunned, **its ability does not trigger** at all (no OnTurnEnd, OnHit, OnAttack — none of it). This is a critical balance lever: it prevents abilities like Rest from self-looping into immortality, and means a well-timed Stun shuts down a high-value enabler.
- **Same-turn stacking**: multiple Stun applications to the same target on the same turn — the **longest** one wins (max of new duration vs. existing remaining duration). Stuns do not add together additively.
- **Different turns**: if a new Stun is applied to a target that is currently Stunned, the same max rule applies — the longer remaining duration is kept.

(Bound is no longer in use; Goldeen/Seaking's ability was redesigned.)

---

## Notes for Implementers

- All percentage modifiers are multiplicative against the running modifier unless explicitly "additive".
- Ability triggers fire in SPD order (when multiple Pokémon would react).
- Abilities with "OnFaint, once" must persist a flag in battle state so the revive trigger can only fire once per battle.
- **All attacks are treated equally** — the game does not distinguish melee from ranged. Abilities that previously referenced "melee" (e.g. Static) now fire on any attack with adjusted probabilities.
- **OnBattleWin trigger** (used by Pickup): fires once at the moment the player's victory is locked in, before money/badge accounting. Only requires the source Pokémon to be on the roster — alive or fainted.
- **OnAllyHit trigger** (used by Stamina, Rivalry): fires whenever any ally on the team — including the Pokémon with the ability — is hit by an enemy attack.
- **OnEnemyFaint trigger** (used by Gluttony): fires whenever any enemy faints, regardless of who dealt the killing blow.
- **OnKO trigger** (used by Pickup, Moxie): fires when this specific Pokémon deals the killing blow to an enemy.
- **Ability suppression while Stunned**: see the Stun section. While a Pokémon is Stunned, none of its ability triggers fire — not OnTurnStart/End, not OnHit, not OnAttack, not OnAllyHit. The ability resumes the moment Stun expires.
- **Adaptability (Eevee)** is resolved at battle start using the team layout at that moment; if Eevee's right-neighbour faints mid-battle, Eevee keeps the copied ability for the rest of the battle.
- **Run Away** position swap happens *before* any subsequent attacks resolve in the same turn — the swapped-in front-row ally is the new target for incoming attacks immediately.
- **Early Bird** turn-order override is resolved before any SPD-based ordering each turn.
- See `OPEN_QUESTIONS.md` for balance and edge cases (most importantly: HM ability reroll pool).
