// Lightweight i18n. Active locale is stored in localStorage under `pm-locale`.
// `t(key, ...args)` returns the active locale's string, falling back to English
// and finally to the raw key if both miss. Values may be plain strings OR
// functions (called with the args) for interpolation.
//
// To re-render after a locale switch, the caller is expected to invoke the
// current phase's render function again — the new strings will be picked up on
// the next setPhase / renderTopbar / etc.

const en = {
  // ─── Main menu ────────────────────────────────────────────────────────
  'menu.ranked': 'Ranked Match',
  'menu.single': 'Single Player',
  'menu.elo': 'ELO',

  // ─── Username setup ───────────────────────────────────────────────────
  'username.welcome': 'Welcome, Trainer!',
  'username.changeTitle': 'Change Your Name',
  'username.label': 'Trainer Name:',
  'username.placeholder': 'Trainer name',
  'username.confirm': 'Confirm',
  'username.back': 'Back',
  'username.err.minLength': 'At least 3 characters.',
  'username.err.maxLength': 'No more than 16 characters.',
  'username.err.chars': 'Only letters, numbers, and underscores.',
  'username.err.startChar': 'Must start with a letter or number.',
  'username.err.taken': 'That name is already taken.',

  // ─── Ranks ────────────────────────────────────────────────────────────
  'rank.poke':   'Poké',
  'rank.great':  'Great',
  'rank.ultra':  'Ultra',
  'rank.master': 'Master',

  // ─── Starter pick ─────────────────────────────────────────────────────
  'starter.title': 'Choose your starter',
  'starter.subtitle': 'Pick one Pokémon to begin your journey.',

  // ─── Adventure events ─────────────────────────────────────────────────
  'event.wild.title': 'Wild Pokémon',
  'event.wild.desc':  'Catch or battle a Pokémon',
  'event.trainer.title': 'Trainer Battle',
  'event.pokeCenter.title': 'PokéCenter',
  'event.pokeCenter.desc':  'Revive your fallen team.',
  'event.berry.title': 'Berry Gathering',
  'event.berry.desc':  'Pick a berry to take with you.',
  'event.trade.title': 'Trading',
  'event.trade.desc':  'Trade with a passing trainer.',
  'event.job.title':   'Part-Time Job',
  'event.job.desc':    (amt) => `Earn $${amt}.`,
  'event.daycare.title': 'Daycare',
  'event.daycare.desc':  (lvls) => `Leave a Pokémon training until next Town. Gains ${lvls} levels.`,
  'event.lostStash.title': 'Lost Stash',
  'event.lostStash.desc':  'Pick one of three random items.',
  'event.wildHorde.title': 'Wild Horde',
  'event.wildHorde.desc':  'Fight 6 of the same Pokémon for +1 team level.',
  'event.wildHorde.intro': (name) => `Six ${name} have appeared. Defeat them for +1 team level.`,
  'event.wildHorde.descSpecific': (name) => `Six ${name} — defeat them for +1 team level.`,

  // ─── Adventure card actions ──────────────────────────────────────────
  'adventure.repelActive': 'Repel active',

  // ─── Wild encounter buttons ──────────────────────────────────────────
  'wild.battle':  'Battle',
  'wild.greatBall': 'Great Ball',
  'wild.lure':    'Lure',
  'wild.skip':    'Skip',
  'wild.catch':   'Catch',
  'wild.appeared': 'Wild Pokémon Appeared!',
  'wild.crosses': (name) => `A wild ${name} crosses your path.`,

  // ─── Capture step (adventure step kind A) ────────────────────────────
  'capture.title':       'Capture a Pokémon',
  'capture.subtitle':    'Pick one of the wild Pokémon below to add to your team, or skip for two small berries.',
  'capture.pick':        'Catch',
  'capture.skip':        'Pick small berries',
  'capture.skipReward':  '+2 small berries',
  'capture.skipNoSlots': 'No item slots free.',
  'capture.fullTeamMsg': (gold) => `Team full — sold for $${gold}.`,
  'capture.lureBtn':     'Lure (reroll both)',

  // ─── Trainer step (adventure step kind B) ────────────────────────────
  'trainer.title':       'Trainer Battle',
  'trainer.subtitle':    'Pick a trainer to challenge, or skip for two small berries.',
  'trainer.normal.title':   'Normal Trainer',
  'trainer.normal.subtitle':(lvl) => `Reward: +${lvl} team levels on win.`,
  'trainer.hard.title':     'Hard Trainer',
  'trainer.hard.subtitle':  (lvl, extraPkmn, lvlBump) => `+${extraPkmn} Pokémon, +${lvlBump} level each. Reward: +${lvl} team levels on win.`,
  'trainer.skip':        'Pick small berries',
  'trainer.skipReward':  '+2 small berries',

  // ─── Special step (adventure step kind C) ────────────────────────────
  'special.title':    'Special Event',
  'special.subtitle': 'Pick one of the two special events below.',

  // ─── Berry gathering ──────────────────────────────────────────────────
  'berry.fullSlots': 'Item slots are full — skipping.',
  'berry.continue':  'Continue.',
  'berry.skip':      'Continue',
  'berry.pickPrompt':'Pick one berry to add to your bag.',
  'berry.boost':     (amount, stat) => `+${amount} ${stat}`,

  // ─── Trading ─────────────────────────────────────────────────────────
  'trade.subtitle': 'Drag one of your Pokémon onto the empty slot to complete the trade.',
  'trade.yourOffer': 'Your Offer',
  'trade.dropHere':  'Drop a Pokémon',
  'trade.trainerOffer': "Trainer's Offer",
  'trade.decline': 'Decline',
  'trade.reroll':  'Use Trade Card',
  'trade.fullSlots': 'No room — skipping.',

  // ─── Daycare ─────────────────────────────────────────────────────────
  'daycare.subtitle': (lvls) => `Drop a Pokémon here. It returns at the start of the next adventure with +${lvls} levels.`,
  'daycare.slotLabel': 'Daycare Slot',
  'daycare.dropPrompt': 'Drop a Pokémon to enroll',
  'daycare.skip': 'Skip',
  'daycare.tag': 'At Daycare',

  // ─── Job ─────────────────────────────────────────────────────────────
  'job.intro': 'A quick job around town.',
  'job.collect': 'Collect',

  // ─── PokéCenter ──────────────────────────────────────────────────────
  'pokeCenter.intro': 'Your team has been fully healed.',
  'pokeCenter.continue': 'Continue',

  // ─── Lost Stash ──────────────────────────────────────────────────────
  'lostStash.subtitle': 'Pick one item — all three are random, no good or bad pick.',

  // ─── Wild horde ──────────────────────────────────────────────────────
  'wildHorde.fight': 'Fight',
  'wildHorde.run':   'Run',

  // ─── Pre-battle ──────────────────────────────────────────────────────
  'preBattle.enter': 'Enter Battle',
  'preBattle.matchmaking': 'Matchmaking…',
  'preBattle.gymLeader': (name) => `Gym Leader ${name}`,
  'preBattle.rankedMatch': 'Ranked Match',
  'preBattle.vs': (name) => `vs ${name}`,

  // ─── Battle ─────────────────────────────────────────────────────────
  'battle.victory': 'Victory',
  'battle.defeat':  'Defeat',
  'battle.draw':    'Draw',
  'battle.continue': 'Continue',
  'battle.start':    'Start',
  'battle.startBattle': 'Start Battle',
  'battle.trainerLabel': (name) => `Trainer: ${name}`,
  'battle.gymLabel':     (name) => `Gym Leader ${name}`,
  'battle.hordeLabel':   (name) => `Wild Horde: ${name}`,
  'battle.searching': 'Searching…',

  // ─── Town ────────────────────────────────────────────────────────────
  'town.title': (zone) => `Town — ${zone}`,
  'town.sellLabel': 'Drag here to sell',
  'town.sellBlockedDaycare': 'At daycare',
  'town.sellBlockedLast': "Can't sell your last Pokémon",
  'town.sellAmount': (n) => `+$${n}`,
  'town.rerollBtn': '↻ Reroll Items',
  'town.continue': 'Continue to next zone',

  // ─── Options ─────────────────────────────────────────────────────────
  'options.abandon': 'Abandon Run',
  'options.confirmAbandon': 'Abandon this run? Progress will be lost.',
  'options.confirmNewRun': 'Start a new run? Your current run will be overwritten.',
  'options.language': 'Language',

  // ─── Pokédex ─────────────────────────────────────────────────────────
  'dex.title': 'Pokédex',
  'dex.meta':  (seen, total, won) => `Seen ${seen} / ${total}  ·  Won with ${won}`,
  'dex.hoverHint': 'Hover or click a Pokémon to see its info.',
  'dex.unseenName': '???',
  'dex.unseenHint': 'Add this Pokémon to your team to learn its details.',
  'dex.medalTitle': 'Won a ranked run with this Pokémon',
  'dex.evolvesInto': (name, level) => `Evolves into <b>${name}</b> at <b>L${level}</b>`,
  'dex.finalForm': 'Final form',

  // ─── Result screens ──────────────────────────────────────────────────
  'result.runComplete': 'Run Complete!',
  'result.runCompleteSub': (name) => `Congratulations, ${name}.`,
  'result.victory': 'Victory!',
  'result.defeat':  'DEFEAT',
  'result.defeatSub': (name) => `${name}, your run has ended.`,
  'result.badgesEarned': 'badges earned',
  'result.zoneReached':  'zone reached',
  'result.singlePlayerNoElo': 'Singleplayer — no ELO change',
  'result.subRank': (cur) => `${cur}/200 to next sub-rank`,
  'result.currentRankTier': 'Current rank tier',
  'result.backToTitle': 'Back to title',

  // ─── Misc items / inventory ──────────────────────────────────────────
  'inventory.slotsFull': 'Item slots full.',
  'inventory.release': 'Release',
  'inventory.releaseConfirm': (name) => `Release ${name}?`,

  // ─── Item names ──────────────────────────────────────────────────────
  'item.tradeCard.name':     'Trade Card',
  'item.revive.name':        'Revive',
  'item.xVitamin.name':      'X-Vitamin',
  'item.greatBall.name':     'Great Ball',
  'item.evosoda.name':       'Evosoda',
  'item.tm.name':            'TM',
  'item.hm.name':            'HM',
  'item.lure.name':          'Lure',
  'item.spiritPendant.name': 'Spirit Pendant',

  // ─── Item descriptions ───────────────────────────────────────────────
  'item.tradeCard.desc':     'During Trading: reroll the offered Pokémon once.',
  'item.revive.desc':        'Revive a fainted Pokémon to full HP.',
  'item.xVitamin.desc':      'Target enters next battle with +50% HP/ATK/SPD.',
  'item.greatBall.desc':     'Capture a wild Pokémon at +3 levels.',
  'item.evosoda.desc':       'Target Pokémon gains 3 levels.',
  'item.tm.desc':            'Reroll the secondary type of a Pokémon. Mono → adds; dual → rerolls.',
  'item.hm.desc':            "Reroll the Pokémon's ability (same evolutionary tier).",
  'item.lure.desc':          'During Wild Encounter: swap to a random Pokémon.',
  'item.spiritPendant.desc': 'Release a Pokémon; both adjacent team members gain +1 level.',

  // ─── Berry names ─────────────────────────────────────────────────────
  'berry.oran.name':       'Oran Berry',
  'berry.cheri.name':      'Cheri Berry',
  'berry.salac.name':      'Salac Berry',
  'berry.oranSmall.name':  'Small Oran',
  'berry.cheriSmall.name': 'Small Cheri',
  'berry.salacSmall.name': 'Small Salac',
  'berry.tooltip': (stat, amount) => `Apply to a Pokémon: raises ${stat} by ${amount} permanently.`,
  'berry.pickedDesc': (stat) => `+20 ${stat}`,

  // ─── Stats ───────────────────────────────────────────────────────────
  'stat.hp':  'HP',
  'stat.atk': 'ATK',
  'stat.spd': 'SPD',
  'slot.level': (n) => `Lv.${n}`,

  // ─── Types ───────────────────────────────────────────────────────────
  'type.normal':   'Normal',
  'type.fire':     'Fire',
  'type.water':    'Water',
  'type.electric': 'Electric',
  'type.grass':    'Grass',
  'type.ice':      'Ice',
  'type.fighting': 'Fighting',
  'type.poison':   'Poison',
  'type.ground':   'Ground',
  'type.flying':   'Flying',
  'type.psychic':  'Psychic',
  'type.bug':      'Bug',
  'type.rock':     'Rock',
  'type.ghost':    'Ghost',
  'type.dragon':   'Dragon',

  // ─── Sell / shop misc ────────────────────────────────────────────────
  'shop.sell':     (price) => `Sell: +$${price}`,

  // ─── Team popups (overlay text above slots) ─────────────────────────
  'popup.evolved':   'EVOLVED!',
  'popup.levels':    (n) => `+${n} LVL`,
  'popup.statBonus': (n, stat) => `+${n} ${(stat + '').toUpperCase()}`,

  // ─── Server status pill (top-left) ──────────────────────────────────
  'status.online':       (n) => n === 1 ? `Online · 1 player` : `Online · ${n} players`,
  'status.offline':      'Offline',
  'status.titleOnline':  (n) => `Server online — ${n} player${n === 1 ? '' : 's'} active in the last 5 minutes.`,
  'status.titleOffline': 'Server unreachable — running in local-only mode.',
};

const ptBR = {
  // ─── Main menu ────────────────────────────────────────────────────────
  'menu.ranked': 'Partida Ranqueada',
  'menu.single': 'Um Jogador',
  'menu.elo': 'ELO',

  // ─── Username setup ───────────────────────────────────────────────────
  'username.welcome': 'Bem-vindo, Treinador!',
  'username.changeTitle': 'Trocar Nome',
  'username.label': 'Nome do Treinador:',
  'username.placeholder': 'Nome do treinador',
  'username.confirm': 'Confirmar',
  'username.back': 'Voltar',
  'username.err.minLength': 'Pelo menos 3 caracteres.',
  'username.err.maxLength': 'No máximo 16 caracteres.',
  'username.err.chars': 'Apenas letras, números e sublinhados.',
  'username.err.startChar': 'Deve começar com letra ou número.',
  'username.err.taken': 'Esse nome já está em uso.',

  // ─── Ranks ────────────────────────────────────────────────────────────
  'rank.poke':   'Poké',
  'rank.great':  'Great',
  'rank.ultra':  'Ultra',
  'rank.master': 'Master',

  // ─── Starter pick ─────────────────────────────────────────────────────
  'starter.title': 'Escolha seu inicial',
  'starter.subtitle': 'Escolha um Pokémon para começar sua jornada.',

  // ─── Adventure events ─────────────────────────────────────────────────
  'event.wild.title': 'Pokémon Selvagem',
  'event.wild.desc':  'Capture ou batalhe um Pokémon',
  'event.trainer.title': 'Batalha de Treinador',
  'event.pokeCenter.title': 'Centro Pokémon',
  'event.pokeCenter.desc':  'Reviva seu time caído.',
  'event.berry.title': 'Coleta de Frutas',
  'event.berry.desc':  'Escolha uma fruta para levar.',
  'event.trade.title': 'Troca',
  'event.trade.desc':  'Negocie com um treinador passante.',
  'event.job.title':   'Bico',
  'event.job.desc':    (amt) => `Ganhe $${amt}.`,
  'event.daycare.title': 'Creche',
  'event.daycare.desc':  (lvls) => `Deixe um Pokémon treinando até a próxima Cidade. Ganha ${lvls} níveis.`,
  'event.lostStash.title': 'Tesouro Perdido',
  'event.lostStash.desc':  'Escolha um de três itens aleatórios.',
  'event.wildHorde.title': 'Horda Selvagem',
  'event.wildHorde.desc':  'Lute contra 6 do mesmo Pokémon por +1 nível de time.',
  'event.wildHorde.intro': (name) => `Seis ${name} apareceram. Derrote-os por +1 nível de time.`,
  'event.wildHorde.descSpecific': (name) => `Seis ${name} — derrote-os por +1 nível de time.`,

  // ─── Adventure card actions ──────────────────────────────────────────
  'adventure.repelActive': 'Repelente ativo',

  // ─── Wild encounter buttons ──────────────────────────────────────────
  'wild.battle':  'Batalhar',
  'wild.greatBall': 'Great Ball',
  'wild.lure':    'Isca',
  'wild.skip':    'Pular',
  'wild.catch':   'Capturar',
  'wild.appeared': 'Um Pokémon Selvagem Apareceu!',
  'wild.crosses': (name) => `Um ${name} selvagem cruza seu caminho.`,

  // ─── Capture step (adventure step kind A) ────────────────────────────
  'capture.title':       'Capturar um Pokémon',
  'capture.subtitle':    'Escolha um dos Pokémon selvagens abaixo para juntar-se ao seu time, ou pegue duas frutas pequenas.',
  'capture.pick':        'Capturar',
  'capture.skip':        'Pegar frutas pequenas',
  'capture.skipReward':  '+2 frutas pequenas',
  'capture.skipNoSlots': 'Sem espaço para itens.',
  'capture.fullTeamMsg': (gold) => `Time cheio — vendido por $${gold}.`,
  'capture.lureBtn':     'Isca (re-sortear ambos)',

  // ─── Trainer step (adventure step kind B) ────────────────────────────
  'trainer.title':       'Batalha de Treinador',
  'trainer.subtitle':    'Escolha um treinador para desafiar, ou pegue duas frutas pequenas.',
  'trainer.normal.title':   'Treinador Normal',
  'trainer.normal.subtitle':(lvl) => `Recompensa: +${lvl} níveis ao time na vitória.`,
  'trainer.hard.title':     'Treinador Difícil',
  'trainer.hard.subtitle':  (lvl, extraPkmn, lvlBump) => `+${extraPkmn} Pokémon, +${lvlBump} nível cada. Recompensa: +${lvl} níveis ao time na vitória.`,
  'trainer.skip':        'Pegar frutas pequenas',
  'trainer.skipReward':  '+2 frutas pequenas',

  // ─── Special step (adventure step kind C) ────────────────────────────
  'special.title':    'Evento Especial',
  'special.subtitle': 'Escolha um dos dois eventos especiais abaixo.',

  // ─── Berry gathering ──────────────────────────────────────────────────
  'berry.fullSlots': 'Slots de itens cheios — pulando.',
  'berry.continue':  'Continuar.',
  'berry.skip':      'Continuar',
  'berry.pickPrompt':'Escolha uma fruta para sua mochila.',
  'berry.boost':     (amount, stat) => `+${amount} ${stat}`,

  // ─── Trading ─────────────────────────────────────────────────────────
  'trade.subtitle': 'Arraste um dos seus Pokémon para o slot vazio para completar a troca.',
  'trade.yourOffer': 'Sua Oferta',
  'trade.dropHere':  'Solte um Pokémon',
  'trade.trainerOffer': 'Oferta do Treinador',
  'trade.decline': 'Recusar',
  'trade.reroll':  'Usar Carta de Troca',
  'trade.fullSlots': 'Sem espaço — pulando.',

  // ─── Daycare ─────────────────────────────────────────────────────────
  'daycare.subtitle': (lvls) => `Solte um Pokémon aqui. Ele retorna no início da próxima aventura com +${lvls} níveis.`,
  'daycare.slotLabel': 'Slot da Creche',
  'daycare.dropPrompt': 'Solte um Pokémon para registrá-lo',
  'daycare.skip': 'Pular',
  'daycare.tag': 'Na Creche',

  // ─── Job ─────────────────────────────────────────────────────────────
  'job.intro': 'Um trabalho rápido pela cidade.',
  'job.collect': 'Coletar',

  // ─── PokéCenter ──────────────────────────────────────────────────────
  'pokeCenter.intro': 'Seu time foi totalmente curado.',
  'pokeCenter.continue': 'Continuar',

  // ─── Lost Stash ──────────────────────────────────────────────────────
  'lostStash.subtitle': 'Escolha um item — os três são aleatórios, sem bom ou ruim.',

  // ─── Wild horde ──────────────────────────────────────────────────────
  'wildHorde.fight': 'Lutar',
  'wildHorde.run':   'Fugir',

  // ─── Pre-battle ──────────────────────────────────────────────────────
  'preBattle.enter': 'Entrar na Batalha',
  'preBattle.matchmaking': 'Procurando partida…',
  'preBattle.gymLeader': (name) => `Líder de Ginásio ${name}`,
  'preBattle.rankedMatch': 'Partida Ranqueada',
  'preBattle.vs': (name) => `vs ${name}`,

  // ─── Battle ─────────────────────────────────────────────────────────
  'battle.victory': 'Vitória',
  'battle.defeat':  'Derrota',
  'battle.draw':    'Empate',
  'battle.continue': 'Continuar',
  'battle.start':    'Iniciar',
  'battle.startBattle': 'Iniciar Batalha',
  'battle.trainerLabel': (name) => `Treinador: ${name}`,
  'battle.gymLabel':     (name) => `Líder de Ginásio ${name}`,
  'battle.hordeLabel':   (name) => `Horda Selvagem: ${name}`,
  'battle.searching': 'Buscando…',

  // ─── Town ────────────────────────────────────────────────────────────
  'town.title': (zone) => `Cidade — ${zone}`,
  'town.sellLabel': 'Arraste aqui para vender',
  'town.sellBlockedDaycare': 'Na creche',
  'town.sellBlockedLast': 'Não pode vender seu último Pokémon',
  'town.sellAmount': (n) => `+$${n}`,
  'town.rerollBtn': '↻ Trocar Itens',
  'town.continue': 'Continuar para a próxima zona',

  // ─── Options ─────────────────────────────────────────────────────────
  'options.abandon': 'Abandonar Run',
  'options.confirmAbandon': 'Abandonar esta run? O progresso será perdido.',
  'options.confirmNewRun': 'Iniciar uma nova run? A atual será substituída.',
  'options.language': 'Idioma',

  // ─── Pokédex ─────────────────────────────────────────────────────────
  'dex.title': 'Pokédex',
  'dex.meta':  (seen, total, won) => `Vistos ${seen} / ${total}  ·  Vencidos com ${won}`,
  'dex.hoverHint': 'Passe o mouse ou clique em um Pokémon para ver as informações.',
  'dex.unseenName': '???',
  'dex.unseenHint': 'Adicione este Pokémon ao seu time para conhecer seus detalhes.',
  'dex.medalTitle': 'Venceu uma run ranqueada com este Pokémon',
  'dex.evolvesInto': (name, level) => `Evolui para <b>${name}</b> no <b>N${level}</b>`,
  'dex.finalForm': 'Forma final',

  // ─── Result screens ──────────────────────────────────────────────────
  'result.runComplete': 'Run Completa!',
  'result.runCompleteSub': (name) => `Parabéns, ${name}.`,
  'result.victory': 'Vitória!',
  'result.defeat':  'DERROTA',
  'result.defeatSub': (name) => `${name}, sua run chegou ao fim.`,
  'result.badgesEarned': 'insígnias',
  'result.zoneReached':  'zona alcançada',
  'result.singlePlayerNoElo': 'Um Jogador — sem mudança de ELO',
  'result.subRank': (cur) => `${cur}/200 até a próxima sub-rank`,
  'result.currentRankTier': 'Tier atual',
  'result.backToTitle': 'Voltar ao título',

  // ─── Misc items / inventory ──────────────────────────────────────────
  'inventory.slotsFull': 'Slots de itens cheios.',
  'inventory.release': 'Liberar',
  'inventory.releaseConfirm': (name) => `Liberar ${name}?`,

  // ─── Item names ──────────────────────────────────────────────────────
  'item.tradeCard.name':     'Carta de Troca',
  'item.revive.name':        'Reviver',
  'item.xVitamin.name':      'X-Vitamina',
  'item.greatBall.name':     'Great Ball',
  'item.evosoda.name':       'Refri Evolutivo',
  'item.tm.name':            'TM',
  'item.hm.name':            'HM',
  'item.lure.name':          'Isca',
  'item.spiritPendant.name': 'Pingente Espiritual',

  // ─── Item descriptions ───────────────────────────────────────────────
  'item.tradeCard.desc':     'Durante uma Troca: re-sorteia o Pokémon ofertado uma vez.',
  'item.revive.desc':        'Reviva um Pokémon desmaiado com HP máximo.',
  'item.xVitamin.desc':      'O alvo entra na próxima batalha com +50% HP/ATK/SPD.',
  'item.greatBall.desc':     'Captura um Pokémon selvagem com +3 níveis.',
  'item.evosoda.desc':       'O Pokémon alvo ganha 3 níveis.',
  'item.tm.desc':            'Re-sorteia o tipo secundário do Pokémon. Mono → adiciona; dual → troca.',
  'item.hm.desc':            'Re-sorteia a habilidade do Pokémon (mesma fase evolutiva).',
  'item.lure.desc':          'Durante um Encontro Selvagem: troca por um Pokémon aleatório.',
  'item.spiritPendant.desc': 'Libera um Pokémon; ambos os aliados adjacentes ganham +1 nível.',

  // ─── Berry names ─────────────────────────────────────────────────────
  'berry.oran.name':       'Fruta Oran',
  'berry.cheri.name':      'Fruta Cheri',
  'berry.salac.name':      'Fruta Salac',
  'berry.oranSmall.name':  'Oran Pequena',
  'berry.cheriSmall.name': 'Cheri Pequena',
  'berry.salacSmall.name': 'Salac Pequena',
  'berry.tooltip': (stat, amount) => `Aplique a um Pokémon: aumenta ${stat} em ${amount} permanentemente.`,
  'berry.pickedDesc': (stat) => `+20 ${stat}`,

  // ─── Stats ───────────────────────────────────────────────────────────
  'stat.hp':  'HP',
  'stat.atk': 'ATK',
  'stat.spd': 'SPD',
  'slot.level': (n) => `N${n}`,

  // ─── Types ───────────────────────────────────────────────────────────
  'type.normal':   'Normal',
  'type.fire':     'Fogo',
  'type.water':    'Água',
  'type.electric': 'Elétrico',
  'type.grass':    'Planta',
  'type.ice':      'Gelo',
  'type.fighting': 'Lutador',
  'type.poison':   'Veneno',
  'type.ground':   'Terra',
  'type.flying':   'Voador',
  'type.psychic':  'Psíquico',
  'type.bug':      'Inseto',
  'type.rock':     'Pedra',
  'type.ghost':    'Fantasma',
  'type.dragon':   'Dragão',

  // ─── Sell / shop misc ────────────────────────────────────────────────
  'shop.sell':     (price) => `Vender: +$${price}`,

  // ─── Team popups (overlay text above slots) ─────────────────────────
  'popup.evolved':   'EVOLUIU!',
  'popup.levels':    (n) => `+${n} NVL`,
  'popup.statBonus': (n, stat) => `+${n} ${(stat + '').toUpperCase()}`,

  // ─── Server status pill (top-left) ──────────────────────────────────
  'status.online':       (n) => n === 1 ? `Online · 1 jogador` : `Online · ${n} jogadores`,
  'status.offline':      'Offline',
  'status.titleOnline':  (n) => `Servidor online — ${n} jogador${n === 1 ? '' : 'es'} ativo${n === 1 ? '' : 's'} nos últimos 5 minutos.`,
  'status.titleOffline': 'Servidor inacessível — rodando em modo local.',

  // ─── Ability names (PT-BR) ──────────────────────────────────────────
  'ability.overgrowth.name':   'Crescimento',
  'ability.blaze.name':        'Chama',
  'ability.shellBash.name':    'Casco Reforçado',
  'ability.static.name':       'Estática',
  'ability.helpingHand.name':  'Mãos Amigas',
  'ability.adaptability.name': 'Adaptabilidade',
  'ability.waterAbsorb.name':  'Absorver Água',
  'ability.pickup.name':       'Coleta',
  'ability.lullaby.name':      'Canção de Ninar',
  'ability.tailwind.name':     'Vento de Cauda',
  'ability.runAway.name':      'Fuga',
  'ability.sniper.name':       'Atirador',
  'ability.shedSkin.name':     'Troca de Pele',
  'ability.poisonPoint.name':  'Ponto Venenoso',
  'ability.coil.name':         'Enrolar',
  'ability.sandVeil.name':     'Véu de Areia',
  'ability.stamina.name':      'Vigor',
  'ability.rivalry.name':      'Rivalidade',
  'ability.healer.name':       'Curandeiro',
  'ability.willOWisp.name':    'Fogo-Fátuo',
  'ability.echolocation.name': 'Ecolocalização',
  'ability.chlorophyll.name':  'Clorofila',
  'ability.effectSpore.name':  'Esporo de Efeito',
  'ability.arenaTrap.name':    'Armadilha de Arena',
  'ability.damp.name':         'Umidade',
  'ability.vitalSpirit.name':  'Espírito Vital',
  'ability.moxie.name':        'Audácia',
  'ability.waterVeil.name':    'Véu de Água',
  'ability.magicGuard.name':   'Guarda Mágica',
  'ability.crossChop.name':    'Golpe Cruzado',
  'ability.gluttony.name':     'Gula',
  'ability.toxicSweat.name':   'Suor Tóxico',
  'ability.rockyHelmet.name':  'Capacete Rochoso',
  'ability.yawn.name':         'Bocejo',
  'ability.magnetPull.name':   'Atração Magnética',
  'ability.earlyBird.name':    'Madrugador',
  'ability.rest.name':         'Descansar',
  'ability.pungentAura.name':  'Aura Pungente',
  'ability.withdraw.name':     'Recolher',
  'ability.hex.name':          'Maldição',
  'ability.rockHead.name':     'Cabeça de Pedra',
  'ability.hypnosis.name':     'Hipnose',
  'ability.guillotine.name':   'Guilhotina',
  'ability.rollout.name':      'Rolagem',
  'ability.solarBeam.name':    'Raio Solar',
  'ability.battleArmor.name':  'Armadura de Batalha',
  'ability.limber.name':       'Flexibilidade',
  'ability.ironFist.name':     'Punho de Ferro',
  'ability.cloudNine.name':    'Nuvem Nove',
  'ability.aftermath.name':    'Sequela',
  'ability.naturalCure.name':  'Cura Natural',
  'ability.constrict.name':    'Constrição',
  'ability.parentalBond.name': 'Laço Parental',
  'ability.toxicSpike.name':   'Espinho Tóxico',
  'ability.predatorsMark.name':'Marca do Predador',
  'ability.mimic.name':        'Mímico',
  'ability.predator.name':     'Predador',
  'ability.disrupt.name':      'Interromper',
  'ability.discharge.name':    'Descarga',
  'ability.flameBody.name':    'Corpo Flamejante',
  'ability.viceGrip.name':     'Garra Forte',
  'ability.trample.name':      'Pisotear',
  'ability.intimidate.name':   'Intimidação',
  'ability.whaleSong.name':    'Canto da Baleia',
  'ability.imposter.name':     'Impostor',
  'ability.explosion.name':    'Explosão',
  'ability.spiralShell.name':  'Concha Espiral',
  'ability.megaDrain.name':    'Mega Dreno',
  'ability.skyHigh.name':      'Voo Alto',
  'ability.thickFat.name':     'Gordura Espessa',
  'ability.marvelScale.name':  'Escama Maravilhosa',
  'ability.encore.name':       'Encore',
  'ability.bodySlam.name':     'Investida',
  'ability.opportunist.name':  'Oportunista',
  'ability.photosynthesis.name':'Fotossíntese',
  'ability.boulderRoll.name':  'Rolagem de Pedra',
  'ability.angerPoint.name':   'Ponto de Fúria',
  'ability.sunbeam.name':      'Raio de Sol',

  // ─── Ability descriptions (PT-BR) ───────────────────────────────────
  'ability.overgrowth.desc.1':  'Ao final de cada turno, recupera 10% do HP máximo.',
  'ability.overgrowth.desc.2':  'Ao final de cada turno, recupera 20% do HP máximo.',
  'ability.overgrowth.desc.3':  'Ao final de cada turno, recupera 30% do HP máximo.',
  'ability.blaze.desc.1':       'Cada ataque queima o alvo causando 4 de dano.',
  'ability.blaze.desc.2':       'Cada ataque queima o alvo causando 8 de dano.',
  'ability.blaze.desc.3':       'Cada ataque queima o alvo causando 12 de dano.',
  'ability.shellBash.desc.1':   'Cada golpe recebido concede permanentemente +3% de redução de dano (limite 50%).',
  'ability.shellBash.desc.2':   'Cada golpe recebido concede permanentemente +5% de redução de dano (limite 50%).',
  'ability.shellBash.desc.3':   'Cada golpe recebido concede permanentemente +8% de redução de dano (limite 50%).',
  'ability.static.desc.1':      'Cada ataque tem 30% de chance de aplicar Atordoamento 1 no alvo.',
  'ability.static.desc.2':      'Cada ataque tem 50% de chance de aplicar Atordoamento 1 no alvo.',
  'ability.helpingHand.desc.1': 'No início da batalha, este Pokémon e aliados adjacentes ganham 20% de HP máximo.',
  'ability.helpingHand.desc.2': 'No início da batalha, este Pokémon e aliados adjacentes ganham 40% de HP máximo.',
  'ability.adaptability.desc.1':'No início da batalha, copia a habilidade do aliado diretamente à direita.',
  'ability.waterAbsorb.desc.1': 'Ao receber um ataque de Água, restaura 25% do HP máximo em vez de tomar dano.',
  'ability.pickup.desc.1':      'Cada batalha vencida concede 100 moedas extras.',
  'ability.pickup.desc.2':      'Cada batalha vencida concede 200 moedas extras.',
  'ability.lullaby.desc.1':     'No início da batalha, atordoa um inimigo aleatório por 2 turnos.',
  'ability.lullaby.desc.2':     'No início da batalha, atordoa um inimigo aleatório por 4 turnos.',
  'ability.tailwind.desc.1':    'Ao final de cada turno, aliados horizontalmente adjacentes ganham 3% ATK. Cumulativo.',
  'ability.tailwind.desc.2':    'Ao final de cada turno, aliados horizontalmente adjacentes ganham 6% ATK. Cumulativo.',
  'ability.tailwind.desc.3':    'Ao final de cada turno, aliados horizontalmente adjacentes ganham 10% ATK. Cumulativo.',
  'ability.runAway.desc.1':     'Na primeira vez que o HP cai abaixo de 30%, troca com o aliado atrás e ganha 20% ATK.',
  'ability.runAway.desc.2':     'Na primeira vez que o HP cai abaixo de 30%, troca com o aliado atrás e ganha 35% ATK.',
  'ability.sniper.desc.1':      'Golpes críticos causam dano triplo, e a taxa de crítico é dobrada.',
  'ability.sniper.desc.2':      'Golpes críticos causam dano quádruplo, e a taxa de crítico é dobrada.',
  'ability.shedSkin.desc.1':    'Na primeira vez que este Pokémon desmaia, renasce com 25% de HP máximo.',
  'ability.shedSkin.desc.2':    'Na primeira vez que este Pokémon desmaia, renasce com 40% de HP máximo.',
  'ability.shedSkin.desc.3':    'Na primeira vez que este Pokémon desmaia, renasce com 55% de HP máximo.',
  'ability.poisonPoint.desc.1': 'Cada ataque aplica Veneno 2 no alvo.',
  'ability.poisonPoint.desc.2': 'Cada ataque aplica Veneno 3 no alvo.',
  'ability.poisonPoint.desc.3': 'Cada ataque aplica Veneno 5 no alvo.',
  'ability.coil.desc.1':        'Cada ataque aumenta permanentemente o ATK deste Pokémon em 5%.',
  'ability.coil.desc.2':        'Cada ataque aumenta permanentemente o ATK deste Pokémon em 10%.',
  'ability.sandVeil.desc.1':    'Ao ser atingido, 20% de chance de não receber dano do ataque.',
  'ability.sandVeil.desc.2':    'Ao ser atingido, 40% de chance de não receber dano do ataque.',
  'ability.stamina.desc.1':     'Toda vez que um aliado é atingido, este Pokémon ganha 2% de HP máximo e atual.',
  'ability.stamina.desc.2':     'Toda vez que um aliado é atingido, este Pokémon ganha 4% de HP máximo e atual.',
  'ability.stamina.desc.3':     'Toda vez que um aliado é atingido, este Pokémon ganha 5% de HP máximo e atual.',
  'ability.rivalry.desc.1':     'Toda vez que um aliado é atingido, este Pokémon ganha 2% ATK.',
  'ability.rivalry.desc.2':     'Toda vez que um aliado é atingido, este Pokémon ganha 4% ATK.',
  'ability.rivalry.desc.3':     'Toda vez que um aliado é atingido, este Pokémon ganha 5% ATK.',
  'ability.healer.desc.1':      'Ao final de cada turno, recupera 8% do HP máximo de si e aliados adjacentes na mesma linha.',
  'ability.healer.desc.2':      'Ao final de cada turno, recupera 15% do HP máximo de si e aliados adjacentes na mesma linha.',
  'ability.willOWisp.desc.1':   'No início de cada turno, queima um inimigo aleatório da fileira traseira causando 4.',
  'ability.willOWisp.desc.2':   'No início de cada turno, queima um inimigo aleatório da fileira traseira causando 7.',
  'ability.echolocation.desc.1':'No início de cada turno, cada inimigo ganha 2% cumulativos de chance de errar seus ataques.',
  'ability.echolocation.desc.2':'No início de cada turno, cada inimigo ganha 4% cumulativos de chance de errar seus ataques.',
  'ability.chlorophyll.desc.1': 'Ao final de cada turno, ganha 5% ATK. Cumulativo.',
  'ability.chlorophyll.desc.2': 'Ao final de cada turno, ganha 8% ATK. Cumulativo.',
  'ability.chlorophyll.desc.3': 'Ao final de cada turno, ganha 12% ATK. Cumulativo.',
  'ability.effectSpore.desc.1': 'Ao ser atingido, 25% de chance de atordoar o atacante por 1 turno.',
  'ability.effectSpore.desc.2': 'Ao ser atingido, 50% de chance de atordoar o atacante por 2 turnos.',
  'ability.arenaTrap.desc.1':   'No início da batalha, a fileira traseira inimiga perde 20% SPD.',
  'ability.arenaTrap.desc.2':   'No início da batalha, a fileira traseira inimiga perde 40% SPD.',
  'ability.damp.desc.1':        'No início da batalha, desabilita permanentemente a habilidade do inimigo diretamente em frente a este Pokémon.',
  'ability.damp.desc.2':        'No início da batalha, desabilita permanentemente as habilidades de ambos os inimigos na coluna oposta.',
  'ability.vitalSpirit.desc.1': 'Abaixo de 50% HP, ataques causam 25% mais dano.',
  'ability.vitalSpirit.desc.2': 'Abaixo de 50% HP, ataques causam 50% mais dano.',
  'ability.moxie.desc.1':       'Cada inimigo derrotado por este Pokémon concede 15% ATK. Cumulativo.',
  'ability.moxie.desc.2':       'Cada inimigo derrotado por este Pokémon concede 30% ATK. Cumulativo.',
  'ability.waterVeil.desc.1':   'Com 75% HP ou mais, ataques causam 10% mais dano.',
  'ability.waterVeil.desc.2':   'Com 75% HP ou mais, ataques causam 20% mais dano.',
  'ability.waterVeil.desc.3':   'Com 75% HP ou mais, ataques causam 30% mais dano.',
  'ability.magicGuard.desc.1':  'Imune a todo dano que não seja de ataques diretos.',
  'ability.magicGuard.desc.2':  'Imune a todo dano que não seja de ataques diretos.',
  'ability.magicGuard.desc.3':  'Imune a todo dano que não seja de ataques diretos.',
  'ability.crossChop.desc.1':   'Cada ataque tem 30% de chance de causar um golpe crítico.',
  'ability.crossChop.desc.2':   'Cada ataque tem 45% de chance de causar um golpe crítico.',
  'ability.crossChop.desc.3':   'Cada ataque tem 60% de chance de causar um golpe crítico.',
  'ability.gluttony.desc.1':    'Quando qualquer inimigo desmaia, recupera 10% do HP máximo.',
  'ability.gluttony.desc.2':    'Quando qualquer inimigo desmaia, recupera 20% do HP máximo.',
  'ability.gluttony.desc.3':    'Quando qualquer inimigo desmaia, recupera 30% do HP máximo.',
  'ability.toxicSweat.desc.1':  'Ao final de cada turno, envenena um inimigo aleatório com 3.',
  'ability.toxicSweat.desc.2':  'Ao final de cada turno, envenena um inimigo aleatório com 5.',
  'ability.rockyHelmet.desc.1': 'Reflete 15% do dano recebido de volta ao atacante.',
  'ability.rockyHelmet.desc.2': 'Reflete 30% do dano recebido de volta ao atacante.',
  'ability.rockyHelmet.desc.3': 'Reflete 45% do dano recebido de volta ao atacante.',
  'ability.yawn.desc.1':        'Ao final do turno 5, derrota instantaneamente um inimigo aleatório. Uma vez por batalha.',
  'ability.yawn.desc.2':        'Ao final do turno 4, derrota instantaneamente um inimigo aleatório. Uma vez por batalha.',
  'ability.magnetPull.desc.1':  'No início da batalha, troca a frente e o fundo de 1 coluna inimiga aleatória.',
  'ability.magnetPull.desc.2':  'No início da batalha, troca a frente e o fundo de 2 colunas inimigas aleatórias.',
  'ability.earlyBird.desc.1':   'Sempre age primeiro a cada turno, independente da Velocidade.',
  'ability.earlyBird.desc.2':   'Sempre age primeiro a cada turno, independente da Velocidade.',
  'ability.rest.desc.1':        'Na primeira vez que o HP cai abaixo de 50%, recupera totalmente e dorme por 3 turnos. Enquanto dormindo, este Pokémon não age. Uma vez por batalha.',
  'ability.rest.desc.2':        'Na primeira vez que o HP cai abaixo de 50%, recupera totalmente e dorme por 3 turnos. Enquanto dormindo, este Pokémon não age. Uma vez por batalha.',
  'ability.pungentAura.desc.1': 'Todos os inimigos são forçados a atacar este Pokémon primeiro, mesmo da fileira traseira.',
  'ability.pungentAura.desc.2': 'Todos os inimigos são forçados a atacar este Pokémon primeiro, mesmo da fileira traseira.',
  'ability.withdraw.desc.1':    'Recebe 15% menos dano de todos os ataques.',
  'ability.withdraw.desc.2':    'Recebe 30% menos dano de todos os ataques.',
  'ability.hex.desc.1':         'Ataques causam +30% de dano contra inimigos sob qualquer status (queimadura, veneno ou atordoamento).',
  'ability.hex.desc.2':         'Ataques causam +50% de dano contra inimigos sob qualquer status (queimadura, veneno ou atordoamento).',
  'ability.hex.desc.3':         'Ataques causam +70% de dano contra inimigos sob qualquer status (queimadura, veneno ou atordoamento).',
  'ability.rockHead.desc.1':    'Imune a todos os efeitos de status.',
  'ability.hypnosis.desc.1':    'Em turnos ímpares, atordoa um inimigo aleatório por 1 turno.',
  'ability.hypnosis.desc.2':    'Em turnos ímpares, atordoa um inimigo aleatório por 2 turnos.',
  'ability.guillotine.desc.1':  'Cada ataque em alvo com HP abaixo de 50% tem 20% de chance de derrotá-lo instantaneamente.',
  'ability.guillotine.desc.2':  'Cada ataque em alvo com HP abaixo de 50% tem 40% de chance de derrotá-lo instantaneamente.',
  'ability.rollout.desc.1':     'Cada ataque causa dano adicional igual a 15% do SPD deste Pokémon.',
  'ability.rollout.desc.2':     'Cada ataque causa dano adicional igual a 30% do SPD deste Pokémon.',
  'ability.solarBeam.desc.1':   'Ao final do turno 3, dispara um raio solar em um inimigo aleatório causando 300% ATK de dano. Uma vez por batalha.',
  'ability.solarBeam.desc.2':   'Ao final do turno 2, dispara um raio solar em um inimigo aleatório causando 300% ATK de dano. Uma vez por batalha.',
  'ability.battleArmor.desc.1': 'Todos os aliados na mesma linha recebem 8% menos dano.',
  'ability.battleArmor.desc.2': 'Todos os aliados na mesma linha recebem 15% menos dano.',
  'ability.limber.desc.1':      'Ataques visam primeiro a fileira traseira inimiga.',
  'ability.ironFist.desc.1':    'A cada segundo ataque, causa 50% mais dano.',
  'ability.cloudNine.desc.1':   'No início da batalha, atordoa ambos os inimigos na mesma coluna por 2 turnos.',
  'ability.aftermath.desc.1':   'Ao desmaiar, causa dano igual a 30% do HP máximo ao atacante.',
  'ability.aftermath.desc.2':   'Ao desmaiar, causa dano igual a 50% do HP máximo ao atacante.',
  'ability.naturalCure.desc.1': 'Ao final de cada turno, cura condições de status em si e aliados adjacentes na mesma linha.',
  'ability.constrict.desc.1':   'Cada ataque reduz permanentemente o SPD do alvo em 50%.',
  'ability.parentalBond.desc.1':'Ataques acertam duas vezes, cada um com 60% de dano.',
  'ability.toxicSpike.desc.1':  'Toda vez que é atingido, envenena o atacante por 2.',
  'ability.toxicSpike.desc.2':  'Toda vez que é atingido, envenena o atacante por 4.',
  'ability.predatorsMark.desc.1':'No início da batalha, todos os inimigos perdem 5% de HP máximo.',
  'ability.predatorsMark.desc.2':'No início da batalha, todos os inimigos perdem 10% de HP máximo.',
  'ability.mimic.desc.1':       'No início da batalha, copia a habilidade do inimigo na mesma coluna.',
  'ability.predator.desc.1':    'Causa 50% mais dano em inimigos com HP abaixo de 50%.',
  'ability.disrupt.desc.1':     'No início da batalha, desabilita todas as outras habilidades de início de batalha em campo.',
  'ability.discharge.desc.1':   'Cada ataque também causa 20% de dano aos outros inimigos na mesma linha.',
  'ability.flameBody.desc.1':   'Ao ser atingido, sempre queima o atacante causando 3.',
  'ability.viceGrip.desc.1':    'Cada ataque reduz permanentemente o ATK do alvo em 15%.',
  'ability.trample.desc.1':     'Ataques em inimigos da fileira frontal também causam 30% de dano ao inimigo da traseira na mesma coluna.',
  'ability.intimidate.desc.1':  'No início da batalha, o inimigo na coluna deste Pokémon perde 5% ATK.',
  'ability.intimidate.desc.2':  'No início da batalha, o inimigo na coluna deste Pokémon perde 50% ATK.',
  'ability.whaleSong.desc.1':   'Ao final do turno 3, todos os aliados recuperam 50% do HP máximo. Uma vez por batalha.',
  'ability.imposter.desc.1':    'No início da batalha, torna-se uma cópia idêntica do aliado diretamente à sua esquerda.',
  'ability.explosion.desc.1':   'No início da batalha, desmaia a si mesmo e derrota o inimigo na mesma linha e coluna que este Pokémon.',
  'ability.spiralShell.desc.1': 'Cada vez que este Pokémon é atingido, o próximo ataque causa 20% de dano bônus.',
  'ability.spiralShell.desc.2': 'Cada vez que este Pokémon é atingido, o próximo ataque causa 40% de dano bônus.',
  'ability.megaDrain.desc.1':   'Recupera 25% do dano causado como HP.',
  'ability.megaDrain.desc.2':   'Recupera 40% do dano causado como HP.',
  'ability.skyHigh.desc.1':     'Não pode ser alvo enquanto qualquer companheiro estiver vivo. Quando for o último Pokémon de pé, torna-se alvo possível.',
  'ability.thickFat.desc.1':    'Inicia cada batalha com 30% de HP máximo extra.',
  'ability.marvelScale.desc.1': 'Sob qualquer condição de status, recebe 25% menos dano.',
  'ability.marvelScale.desc.2': 'Sob qualquer condição de status, recebe 35% menos dano.',
  'ability.marvelScale.desc.3': 'Sob qualquer condição de status, recebe 50% menos dano.',
  'ability.encore.desc.1':      'Quando o aliado na mesma coluna ativa uma habilidade, ela é ativada uma vez adicional.',
  'ability.bodySlam.desc.1':    'Cada ataque causa dano adicional igual a 20% do HP atual deste Pokémon.',
  'ability.opportunist.desc.1': 'Toda vez que um inimigo é recém-atordoado, este Pokémon faz um ataque grátis contra esse inimigo.',
  'ability.photosynthesis.desc.1':'Quando qualquer habilidade aliada é ativada, este Pokémon recupera 8% do HP máximo.',
  'ability.photosynthesis.desc.2':'Quando qualquer habilidade aliada é ativada, este Pokémon recupera 14% do HP máximo.',
  'ability.photosynthesis.desc.3':'Quando qualquer habilidade aliada é ativada, este Pokémon recupera 20% do HP máximo.',
  'ability.boulderRoll.desc.1': 'No início da batalha, carrega o Pokémon oposto com 50% do dano de um ataque normal.',
  'ability.boulderRoll.desc.2': 'No início da batalha, carrega o Pokémon oposto com o dano de um ataque normal completo.',
  'ability.angerPoint.desc.1':  'Quando um aliado desmaia, este Pokémon ganha 15% ATK.',
  'ability.angerPoint.desc.2':  'Quando um aliado desmaia, este Pokémon ganha 30% ATK.',
  'ability.sunbeam.desc.1':     'Quando um aliado é curado, dispara um raio em inimigo aleatório causando 15% do dano de ataque normal.',
  'ability.sunbeam.desc.2':     'Quando um aliado é curado, dispara um raio em inimigo aleatório causando 30% do dano de ataque normal.',
};

const dict = { en, 'pt-BR': ptBR };
const FALLBACK = 'en';

let currentLocale = (typeof localStorage !== 'undefined' && localStorage.getItem('pm-locale')) || FALLBACK;
if (!dict[currentLocale]) currentLocale = FALLBACK;

export function getLocale() { return currentLocale; }
export function availableLocales() { return Object.keys(dict); }

// Set the active locale and persist. Caller is expected to trigger a UI re-render
// after this returns so the new strings flow through.
export function setLocale(locale) {
  if (!dict[locale]) return false;
  currentLocale = locale;
  try { localStorage.setItem('pm-locale', locale); } catch {}
  return true;
}

// Translate a key. If the value is a function, it's called with the trailing args
// (useful for interpolation). Falls back to English, then to the raw key.
export function t(key, ...args) {
  const val = (dict[currentLocale] && dict[currentLocale][key]) ?? dict[FALLBACK][key] ?? key;
  return typeof val === 'function' ? val(...args) : val;
}
