// Game phases: starter → adventure → battle → town → repeat.
import { SPECIES, ITEMS, BERRIES, ZONES, GYM_LEADERS, TRAINERS, RUN, rankFromElo } from './data.js';
import { newRng, buildTeam, simulate, actualStats } from './engine.js';
import * as S from './state.js';
import { setPhase, phaseHeader, renderTopbar, renderTeam, renderItems, attachTooltip, SPRITE_URL, abilityTooltip, abilityName, itemTooltip, pokemonCardInnerHTML, itemIcon, TRAINER_SPRITE_URL, setTopbarStep, ITEM_ICON_URL, resetTopbarTrack, rankIcon } from './ui.js';
import { markTeamAsSeen, markRankedWin, getSeenSet, getWonSet } from './dex.js';
import { saveSnapshot, syncSnapshots, snapshotCount, findLocalMatch, getKnownPlayerNames } from './snapshots.js';
import { t, getLocale, setLocale } from './i18n.js';
import { refreshServerStatusLabels } from './serverStatus.js';
import { spawnConfettiBurst, startConfettiRain } from './confetti.js';

let state = null;
let rng = null;

const EVENT_TYPES = ['wild','trainer','berry','trade','pokeCenter'];

// Persist current state to localStorage. Called at every transition / mutating action
// so a page refresh always lands the player on the same screen with the same progress.
function save() { S.saveRun(state); }

// ─── Team-slot popup queue ───────────────────────────────────────────────
// Level-ups can happen while the team display is hidden (e.g. during a battle
// animation) so the popups are queued at the event source and flushed after the
// next repaint, when the team display is freshly mounted and visible.
const pendingTeamPopups = [];
function queueTeamPopup(slot, text, klass = '') {
  pendingTeamPopups.push({ slot, text, klass });
}
function flushTeamPopups() {
  if (!pendingTeamPopups.length) return;
  // Defer one frame so the renderTeam DOM is fully laid out before we measure.
  requestAnimationFrame(() => {
    const popups = pendingTeamPopups.splice(0);
    let stagger = 0;
    for (const { slot, text, klass } of popups) {
      const el = document.querySelector(`#team-display .slot[data-slot="${slot}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const p = document.createElement('div');
      p.className = 'team-popup ' + klass;
      p.textContent = text;
      p.style.left = (r.left + r.width / 2) + 'px';
      p.style.top  = (r.top + r.height * 0.30) + 'px';
      if (stagger) p.style.animationDelay = stagger + 'ms';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1900 + stagger);
      stagger += 120;             // gentle stagger when multiple slots level at once
    }
  });
}

// `grantTeamExp` wrapper that compares the team before/after the XP grant and queues a
// "+N LVL" or "EVOLVED!" popup for each Pokémon that changed. Used everywhere an XP
// grant happens (wild defeats, trainer wins, gym/PvP).
function grantTeamExpWithPopups(levels) {
  const before = {};
  for (const [slot, p] of Object.entries(state.team)) {
    before[slot] = { speciesId: p.speciesId, level: p.level };
  }
  S.grantTeamExp(state, levels);
  for (const [slot, p] of Object.entries(state.team)) {
    const b = before[slot]; if (!b) continue;
    if (p.speciesId !== b.speciesId) {
      queueTeamPopup(slot, t('popup.evolved'), 'evolve');         // evolution implies levels; show only the bigger event
    } else if (p.level > b.level) {
      queueTeamPopup(slot, t('popup.levels', p.level - b.level), 'level');
    }
  }
}

function repaint() {
  renderTopbar(state);
  renderTeam(state, { onSwap, onUseItem });
  renderItems(state, { onUseItem });
  updateOptionsButton();
  // Pokédex "seen" tracking — any Pokémon currently on the team has, by definition,
  // been seen by the player. Done here (not at addToTeam call sites) so every path
  // into the team — starter pick, capture, trade, daycare return, evolution — is
  // covered by a single hook.
  markTeamAsSeen(state);
  // Auto-save on every repaint — repaint is the canonical "state changed, refresh UI"
  // signal, so co-locating the save here covers every mutating action by construction.
  if (state) save();
  flushTeamPopups();
}

function onSwap(fromSlot, toSlot) {
  const a = state.team[fromSlot], b = state.team[toSlot];
  if (b) state.team[fromSlot] = b; else delete state.team[fromSlot];
  if (a) state.team[toSlot] = a;
  repaint();
}

// Item usage: itemId comes from item slot drag; target is { type: 'pokemon', slot } or { type: 'event', ... }
function onUseItem(itemId, target) {
  const idx = S.findItem(state, itemId);
  if (idx < 0) return;
  const def = ITEMS[itemId] || BERRIES[itemId];
  if (!def) return;
  // Berry use on Pokémon — flat +20 (regular) or +5 (small) to the relevant stat.
  // Fixed values are fairer than % scaling, which punished low-stat Pokémon.
  if (BERRIES[itemId] && target.type === 'pokemon') {
    const p = state.team[target.slot]; if (!p || p.inDaycare) return;
    const b = BERRIES[itemId];
    const BONUS = b.small ? 5 : 20;
    if (b.stat === 'hp')  {
      p.hpBonus += BONUS; p.hpMax += BONUS; p.hp += BONUS;
    }
    if (b.stat === 'atk') {
      p.atkBonus += BONUS; p.atk += BONUS;
    }
    if (b.stat === 'spd') {
      p.spdBonus += BONUS; p.spd += BONUS;
    }
    // Surface the gain over the slot so the player sees the boost land. Class names
    // map to the existing .team-popup palette (.evolve / .level — reusing .level here
    // since it's the green "+N" style).
    queueTeamPopup(target.slot, t('popup.statBonus', BONUS, t('stat.' + b.stat)), 'level');
    S.removeItem(state, idx); repaint(); return;
  }
  // Item dispatch
  // Revive was retired alongside the "always heal after every battle" rework — no
  // Pokémon stays fainted between battles anymore, so there's nothing to revive.
  if (itemId === 'xVitamin' && target.type === 'pokemon') {
    const p = state.team[target.slot]; if (!p || p.inDaycare) return;
    p.xVitamin = true; S.removeItem(state, idx); repaint(); return;
  }
  if (itemId === 'evosoda' && target.type === 'pokemon') {
    const p = state.team[target.slot]; if (!p || p.inDaycare) return;
    const beforeSpecies = p.speciesId, beforeLevel = p.level;
    p.level += 3; S.checkEvolve(p);
    const sp = SPECIES[p.speciesId]; const stats = actualStats(sp, p.level);
    p.hpMax = stats.hp + p.hpBonus; p.atk = stats.atk + p.atkBonus; p.spd = stats.spd + p.spdBonus;
    p.hp = p.hpMax;
    // Surface what happened above the slot — evolution if it changed species, otherwise just the level bump.
    if (p.speciesId !== beforeSpecies) queueTeamPopup(target.slot, 'EVOLVED!', 'evolve');
    else if (p.level > beforeLevel)    queueTeamPopup(target.slot, t('popup.levels', p.level - beforeLevel), 'level');
    S.removeItem(state, idx); repaint(); return;
  }
  if (itemId === 'tm' && target.type === 'pokemon') {
    const p = state.team[target.slot]; if (!p || p.inDaycare) return;
    S.rerollType(p); S.removeItem(state, idx); repaint(); return;
  }
  if (itemId === 'hm' && target.type === 'pokemon') {
    const p = state.team[target.slot]; if (!p || p.inDaycare) return;
    // Find another species at same stage and copy its ability
    const sp = SPECIES[p.speciesId];
    const sameStage = Object.values(SPECIES).filter(x => x.stage === sp.stage && x.ability !== p.ability);
    if (sameStage.length) {
      p.ability = sameStage[Math.floor(Math.random() * sameStage.length)].ability;
      // Lock the ability so a future evolution doesn't overwrite the player's HM choice
      // with the next-stage species' canonical ability. The ability ID is preserved
      // intact — its stage-scaled value automatically advances because the engine reads
      // stage from `species.stage`, which DOES update on evolution.
      p.abilityLocked = true;
    }
    S.removeItem(state, idx); repaint(); return;
  }
  if (itemId === 'spiritPendant' && target.type === 'pokemon') {
    // Sacrifice mechanic — release the target Pokémon and grant +1 level to both
    // horizontally-adjacent team members (same row, column ±1 in the F1-F2-F3 /
    // B1-B2-B3 grid). The +1 may push the ally past its evolution threshold, in
    // which case the EVOLVED popup is shown instead of the level popup. Requires
    // at least one adjacent ally on the team, and keeps the team-min-1 invariant.
    //
    // Design note: this used to grant 10% of the sacrificed Pokémon's highest stat,
    // but HP is always the highest-magnitude stat by far, so the buff effectively
    // always meant +HP. A flat +1 level keeps the synergy intuitive and gives the
    // bonus the chance to trigger an evolution, which feels meaningful.
    const p = state.team[target.slot]; if (!p || p.inDaycare) return;
    if (S.teamCount(state) <= 1) return;                          // can't release the last Pokémon
    const row = target.slot[0];                                    // 'F' or 'B'
    const col = parseInt(target.slot[1], 10);                      // 1..3
    const adjSlots = [];
    if (col > 1) adjSlots.push(row + (col - 1));
    if (col < 3) adjSlots.push(row + (col + 1));
    const adjAllies = adjSlots
      .map(s => ({ slot: s, ally: state.team[s] }))
      .filter(x => x.ally && !x.ally.inDaycare);
    if (adjAllies.length === 0) return;                            // refuse if no adjacent ally to benefit
    // Apply +1 level to each adjacent ally. Mirrors the Evosoda flow: bump level,
    // checkEvolve, recompute stats from the (possibly new) species + level, refill HP.
    for (const { slot, ally } of adjAllies) {
      const beforeSpecies = ally.speciesId, beforeLevel = ally.level;
      ally.level += 1;
      S.checkEvolve(ally);
      const sp = SPECIES[ally.speciesId];
      const stats = actualStats(sp, ally.level);
      ally.hpMax = stats.hp + (ally.hpBonus || 0);
      ally.atk   = stats.atk + (ally.atkBonus || 0);
      ally.spd   = stats.spd + (ally.spdBonus || 0);
      ally.hp    = ally.hpMax;     // sacrifice also fully heals the recipient
      if (ally.speciesId !== beforeSpecies) queueTeamPopup(slot, t('popup.evolved'), 'evolve');
      else if (ally.level > beforeLevel)    queueTeamPopup(slot, t('popup.levels', ally.level - beforeLevel), 'level');
    }
    // Release the sacrifice and consume the item.
    delete state.team[target.slot];
    S.removeItem(state, idx); repaint(); return;
  }
  // Great Ball, Trade Card, Lure: handled in their event phases (this just no-ops here)
}

// ─── Options menu (corner button) ────────────────────────────────────────
function hideOptionsMenu() {
  const m = document.querySelector('#options-menu');
  if (m) m.classList.add('hidden');
}
// Options + Pokédex corner buttons. Both are visible everywhere (main menu, mid-run,
// end-of-run); the Abandon Run menu item inside the options dropdown is the only thing
// that gates on having a live run — see initOptionsMenu().
function updateOptionsButton() {
  const optBtn = document.querySelector('#options-btn');
  const dexBtn = document.querySelector('#dex-btn');
  if (optBtn) optBtn.classList.remove('hidden');
  if (dexBtn) dexBtn.classList.remove('hidden');
  // The dropdown only closes itself when no run is active; the button itself stays.
  if (!state || state.runOver) hideOptionsMenu();
  const abandon = document.querySelector('#opt-abandon');
  if (abandon) abandon.style.display = (state && !state.runOver) ? '' : 'none';
}
// Re-applies the language-dependent text inside the static parts of the options
// menu (labels, button captions) so a locale switch updates them in place without
// needing a full screen re-render. Also updates the .active flag on the flag picker.
function refreshOptionsMenuLabels() {
  const langLabel = document.querySelector('#opt-lang-label');
  if (langLabel) langLabel.textContent = t('options.language');
  const abandon = document.querySelector('#opt-abandon');
  if (abandon) abandon.textContent = t('options.abandon');
  document.querySelectorAll('#options-menu .lang-flag').forEach(el => {
    el.classList.toggle('active', el.dataset.lang === getLocale());
  });
}

// Wire the corner button + dismissal-on-outside-click ONCE at module load.
function initOptionsMenu() {
  const btn = document.querySelector('#options-btn');
  const menu = document.querySelector('#options-menu');
  const abandon = document.querySelector('#opt-abandon');
  if (!btn || !menu || !abandon) return;
  refreshOptionsMenuLabels();
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    refreshOptionsMenuLabels();
    menu.classList.toggle('hidden');
  });
  // Click anywhere outside the menu closes it.
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('hidden')) return;
    if (e.target === btn || btn.contains(e.target)) return;
    if (menu.contains(e.target)) return;
    menu.classList.add('hidden');
  });
  abandon.addEventListener('click', () => {
    menu.classList.add('hidden');
    if (confirm(t('options.confirmAbandon'))) abandonRun();
  });
  // Language flag clicks — set the locale, then re-render whatever the player was
  // looking at. Mid-run screens come back via navigateToCurrentPhase; the title
  // screen comes back via showTitle (state is null there).
  document.querySelectorAll('#options-menu .lang-flag').forEach(el => {
    el.addEventListener('click', () => {
      const lang = el.dataset.lang;
      if (!lang || lang === getLocale()) return;
      setLocale(lang);
      refreshOptionsMenuLabels();
      refreshServerStatusLabels();
      if (state) navigateToCurrentPhase();
      else      showTitle();
    });
  });
}
// ─── Pokédex panel ────────────────────────────────────────────────────────
// Opens the modal overlay, renders the species grid, wires hover/click handlers on
// each entry to populate the right-hand detail card. The seen / won sets come from
// dex.js (localStorage-backed, persists across runs). The detail card reuses the
// same data shapes as the in-run Pokémon cards, but driven by SPECIES base stats
// since no instance exists outside of a run.
function openDexPanel() {
  const panel = document.querySelector('#dex-panel');
  if (!panel) return;
  renderDexPanel();
  panel.classList.remove('hidden');
}
function closeDexPanel() {
  document.querySelector('#dex-panel')?.classList.add('hidden');
}

function renderDexPanel() {
  const seen = getSeenSet();
  const won  = getWonSet();
  const all  = Object.values(SPECIES).sort((a, b) => a.id - b.id);

  // Header meta — running totals.
  const seenCount = all.filter(s => seen.has(s.id)).length;
  const wonCount  = all.filter(s => won.has(s.id)).length;
  const metaEl = document.querySelector('#dex-panel .dex-meta');
  if (metaEl) metaEl.textContent = t('dex.meta', seenCount, all.length, wonCount);
  // Also localize the static title + hover hint inside the modal.
  const titleEl = document.querySelector('#dex-panel .dex-title');
  if (titleEl) titleEl.textContent = t('dex.title');
  const emptyEl = document.querySelector('#dex-panel .dex-detail-empty');
  if (emptyEl) emptyEl.textContent = t('dex.hoverHint');

  // Grid cells. Each entry caches the species id on its dataset so the hover/click
  // handler can look up the species and update the detail pane.
  const gridEl = document.querySelector('#dex-panel .dex-grid');
  if (gridEl) {
    gridEl.innerHTML = all.map(sp => {
      const cls = ['dex-item'];
      if (seen.has(sp.id)) cls.push('seen');
      if (won.has(sp.id))  cls.push('won');
      const num = String(sp.id).padStart(3, '0');
      return `<div class="${cls.join(' ')}" data-id="${sp.id}">
        ${won.has(sp.id) ? `<div class="dex-medal" title="${t('dex.medalTitle')}">🏅</div>` : ''}
        <img src="${SPRITE_URL(sp.id)}" alt="${sp.name}" loading="lazy">
        <div class="dex-num">#${num}</div>
        <div class="dex-name">${sp.name}</div>
      </div>`;
    }).join('');

    // Hover (and click) → populate the detail pane. Click "sticks" by leaving the last
    // hovered card up — that satisfies the "or click" half of the user's spec without
    // needing a separate sticky state.
    const detailEl = document.querySelector('#dex-panel .dex-detail');
    const showDetail = (sp) => {
      if (!detailEl) return;
      detailEl.innerHTML = renderDexCard(sp, seen.has(sp.id), won.has(sp.id));
    };
    gridEl.querySelectorAll('.dex-item').forEach(el => {
      const id = parseInt(el.dataset.id, 10);
      const sp = SPECIES[id];
      if (!sp) return;
      el.addEventListener('mouseenter', () => showDetail(sp));
      el.addEventListener('click',      () => showDetail(sp));
    });
  }
}

// Detail card HTML for the right-side preview. Pulls base stats + ability info from
// SPECIES directly — no run instance needed. Unseen species render a silhouette card
// so the player can't farm dex info by hover-scrubbing.
function renderDexCard(sp, isSeen, isWon) {
  const num = String(sp.id).padStart(3, '0');
  if (!isSeen) {
    return `<div class="dex-card unseen-card">
      <img class="dex-card-sprite" src="${SPRITE_URL(sp.id)}" alt="${t('dex.unseenName')}">
      <div class="dex-card-header">
        <div class="dex-card-num">#${num}</div>
        <div class="dex-card-name">${t('dex.unseenName')}</div>
      </div>
      <div class="dex-detail-empty">${t('dex.unseenHint')}</div>
    </div>`;
  }
  // Local var `typ` avoids shadowing the imported `t` from i18n inside the map.
  const types = [sp.type1, sp.type2].filter(Boolean)
    .map(typ => `<span class="type-capsule type-${typ}">${t('type.' + typ)}</span>`).join('');
  let evoLine;
  if (sp.evolvesTo && sp.evolvesAt) {
    const nextSp = SPECIES[sp.evolvesTo];
    evoLine = t('dex.evolvesInto', nextSp ? nextSp.name : '?', sp.evolvesAt);
  } else {
    evoLine = t('dex.finalForm');
  }
  return `<div class="dex-card${isWon ? ' won-card' : ''}">
    <img class="dex-card-sprite" src="${SPRITE_URL(sp.id)}" alt="${sp.name}">
    <div class="dex-card-header">
      <div class="dex-card-num">#${num}${isWon ? '  🏅' : ''}</div>
      <div class="dex-card-name">${sp.name}</div>
      <div class="dex-card-types">${types}</div>
    </div>
    <div class="dex-card-stats">
      <div><div class="stat-val">${sp.hp}</div><div class="stat-label">${t('stat.hp')}</div></div>
      <div><div class="stat-val">${sp.atk}</div><div class="stat-label">${t('stat.atk')}</div></div>
      <div><div class="stat-val">${sp.spd}</div><div class="stat-label">${t('stat.spd')}</div></div>
    </div>
    <div class="dex-card-evo">${evoLine}</div>
    <div class="dex-card-ability">${abilityName(sp.ability)}</div>
    <div class="dex-card-ability-desc">${abilityTooltip(sp.ability, sp.stage)}</div>
  </div>`;
}

function initDexButton() {
  const btn = document.querySelector('#dex-btn');
  const panel = document.querySelector('#dex-panel');
  const close = document.querySelector('#dex-close');
  if (!btn || !panel) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); openDexPanel(); });
  close?.addEventListener('click', closeDexPanel);
  // Clicking the dimmed backdrop (but not the shell) closes the panel.
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closeDexPanel();
  });
  // Escape key closes the panel too.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('hidden')) closeDexPanel();
  });
}

// Run once the DOM is ready (main.js already triggers showTitle on DOMContentLoaded,
// but the options + dex nodes exist on initial HTML so we can wire them eagerly here).
if (typeof document !== 'undefined') {
  const init = () => { initOptionsMenu(); initDexButton(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

// ─── Phase: title screen ─────────────────────────────────────────────────
export function showTitle() {
  // Auto-resume: if there's a saved run in progress, jump straight back into it
  // instead of showing the title. The player still gets a chance to leave it via
  // the corner Options menu → Abandon Run.
  const saved = S.loadRun();
  if (saved && !saved.runOver) {
    resumeRun(saved);
    return;
  }
  // Best-effort flush of any queued PvP snapshots. If the server isn't up yet, the
  // queue is left intact and we retry on the next title-screen visit. Fires only
  // when there's something to send so we don't ping the server with empty payloads.
  if (snapshotCount() > 0) {
    import('./api.js').then(({ api }) => syncSnapshots(api.submitSnapshots).catch(() => {}));
  }
  // First-time gate — if there's no saved username yet, show the dedicated name input
  // screen instead of jumping straight to the menu. The browser `prompt()` fallback
  // in startRun is now dead code on the happy path; it remains as a safety net.
  if (!localStorage.getItem('pm-name')) {
    showUsernameSetup();
    return;
  }
  setTopbarStep(null);
  document.querySelector('#topbar').classList.add('hidden');
  document.querySelector('#bottombar').classList.add('hidden');
  hideOptionsMenu();
  updateOptionsButton();
  // Build a duplicated row of every species sprite for the scrolling carousel. The row
  // is rendered twice (back-to-back) so the CSS animation from translateX(0) →
  // translateX(-50%) yields a seamless infinite loop.
  const allSpeciesIds = Object.keys(SPECIES).map(Number).filter(id => SPECIES[id]);
  // No loading="lazy" here — sprites that haven't scrolled into view yet still need to
  // be ready when the carousel animation reaches them; otherwise the second pass would
  // show empty frames until each one finally requests.
  const carouselSprites = allSpeciesIds
    .map(id => `<img src="${SPRITE_URL(id)}" alt="${SPECIES[id].name}">`).join('');
  // Player identity block — name + rank tier (with ball icon) + ELO number. Reads
  // straight from localStorage so it stays in sync with what the topbar would show
  // mid-run. Roman numerals match the topbar sub-rank rendering.
  const playerName = localStorage.getItem('pm-name') || 'Player';
  const elo = parseInt(localStorage.getItem('pm-elo') || '0', 10);
  const r = rankFromElo(elo);
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  const rankSub = ROMAN[r.sub] || String(r.sub);
  setPhase(`
    <div class="start-screen">
      <h1>PokeMini</h1>
      <div class="start-player-info">
        <div class="start-player-name">${escapeHtml(playerName)}</div>
        <div class="start-player-rank">
          <img src="${rankIcon(r.tier)}" class="start-rank-icon" alt="${r.tier} Ball">
          <span class="start-rank-tier">${r.tier} ${rankSub}</span>
          <span class="start-rank-elo">${elo} ${t('menu.elo')}</span>
        </div>
      </div>
      <div class="mode-buttons">
        <button id="btn-ranked">${t('menu.ranked')}</button>
        <button id="btn-singleplayer">${t('menu.single')}</button>
      </div>
      <div class="start-carousel" aria-hidden="true">
        <div class="start-carousel-track">${carouselSprites}${carouselSprites}</div>
      </div>
    </div>
  `);
  document.querySelector('#btn-ranked').onclick = () => startRun('ranked');
  document.querySelector('#btn-singleplayer').onclick = () => startRun('singleplayer');
}

// Dedicated trainer-name entry screen. Shown on first launch (no `pm-name` in
// localStorage) before the main menu, and reachable later via the "Change name"
// link on the title screen. `editing=true` is the change-name path, which keeps
// the existing name pre-filled and lets the player escape via the Back button.
// Username validation rules — kept in one place so the UI helper text and the
// submit-time check stay in sync. Returns either { ok:true, value } (cleaned) or
// { ok:false, error } so the caller can show the right hint. Error messages route
// through i18n so they're translated alongside the rest of the UI.
function validateUsername(raw) {
  const v = (raw || '').trim();
  if (v.length === 0) return { ok: false, error: '' };
  if (v.length < 3)   return { ok: false, error: t('username.err.minLength') };
  if (v.length > 16)  return { ok: false, error: t('username.err.maxLength') };
  if (!/^[A-Za-z0-9_]+$/.test(v)) return { ok: false, error: t('username.err.chars') };
  if (!/^[A-Za-z0-9]/.test(v))    return { ok: false, error: t('username.err.startChar') };
  const lower = v.toLowerCase();
  const myCurrent = (localStorage.getItem('pm-name') || '').trim().toLowerCase();
  if (lower !== myCurrent && getKnownPlayerNames().has(lower)) {
    return { ok: false, error: t('username.err.taken') };
  }
  return { ok: true, value: v };
}

function showUsernameSetup(editing = false) {
  setTopbarStep(null);
  document.querySelector('#topbar').classList.add('hidden');
  document.querySelector('#bottombar').classList.add('hidden');
  hideOptionsMenu();
  updateOptionsButton();
  const existing = localStorage.getItem('pm-name') || '';
  setPhase(`
    <div class="username-screen">
      <h1>${editing ? t('username.changeTitle') : t('username.welcome')}</h1>
      <div class="username-subtitle">${t('username.label')}</div>
      <input class="username-input" id="username-input" type="text" maxlength="16"
        placeholder="${t('username.placeholder')}" value="${escapeHtml(existing)}" autocomplete="off">
      <div class="username-hint" id="username-hint" hidden></div>
      <div class="username-actions">
        ${editing ? `<button id="username-back">${t('username.back')}</button>` : ''}
        <button class="primary" id="username-confirm">${t('username.confirm')}</button>
      </div>
    </div>
  `);
  const input = document.querySelector('#username-input');
  const confirm = document.querySelector('#username-confirm');
  const hint = document.querySelector('#username-hint');
  // Hint is invisible by default — only shows up if the player has typed something that
  // breaks a rule. Empty field => no error, no hint. Once typing produces a violation,
  // the matching rule is surfaced; clearing it back to valid hides the hint again.
  let touched = false;
  const updateState = () => {
    const result = validateUsername(input.value);
    confirm.disabled = !result.ok;
    const showError = touched && !result.ok && result.error;
    if (showError) {
      hint.textContent = result.error;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  };
  updateState();
  input.addEventListener('input', () => { touched = true; updateState(); });
  input.addEventListener('blur',  () => { touched = true; updateState(); });
  // Enter key submits when the name is valid.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !confirm.disabled) confirm.click();
  });
  confirm.onclick = async () => {
    const result = validateUsername(input.value);
    if (!result.ok) {
      // User clicked confirm with an invalid field — surface the rule even if they
      // hadn't typed yet, so an empty submit isn't silently ignored.
      touched = true;
      updateState();
      return;
    }
    // Server-side claim: ask the VPS to lock this name to a token we'll keep in
    // localStorage. If the name is taken (409) we surface the localized error.
    // If the server isn't reachable (offline / dev without the server up), we
    // fall back to local-only — the name is reserved against this browser via
    // pm-name but isn't globally unique. Once the player goes back online the
    // claim will retry on the next confirm.
    confirm.disabled = true;
    const prevText = confirm.textContent;
    confirm.textContent = '…';
    try {
      const { api, clearToken } = await import('./api.js');
      try {
        await api.claimName(result.value);
        // Success — token is stashed by api.claimName.
      } catch (e) {
        if (e.status === 409) {
          touched = true;
          hint.textContent = t('username.err.taken');
          hint.hidden = false;
          confirm.disabled = false;
          confirm.textContent = prevText;
          return;
        }
        // Network or 5xx — clear any stale token so the next online attempt
        // does a fresh claim, then proceed in offline mode. Name uniqueness
        // is local-only until the next online session.
        clearToken();
      }
    } catch { /* api module failed to load — proceed offline */ }
    localStorage.setItem('pm-name', result.value);
    showTitle();
  };
  if (editing) {
    document.querySelector('#username-back').onclick = () => showTitle();
  }
  // Focus the field immediately so the player can type without clicking first.
  setTimeout(() => input.focus(), 50);
}

function startRun(mode) {
  // Guard against accidentally overwriting an in-progress save.
  const existing = S.loadRun();
  if (existing && !existing.runOver) {
    if (!confirm(t('options.confirmNewRun'))) return;
  }
  // Name is guaranteed to exist — showTitle() gates on it via showUsernameSetup() and
  // the prompt fallback is only a safety net if someone hits startRun out-of-order.
  const name = localStorage.getItem('pm-name') || prompt('Your name?') || 'Player';
  if (!localStorage.getItem('pm-name')) localStorage.setItem('pm-name', name);
  // Starting a brand-new run wipes any previous save.
  S.clearRun();
  state = S.newRun({ mode, playerName: name, elo: parseInt(localStorage.getItem('pm-elo') || '0', 10) });
  rng = newRng(state.seed);
  state.phase = 'starterPick';
  resetTopbarTrack();   // seed prev money/strikes so the first render doesn't pop a delta
  save();
  repaint();
  showStarterPick();
}

// Restore a previously-saved run and jump to whichever screen the player was on.
function resumeRun(saved) {
  state = saved;
  rng = newRng(state.seed);
  resetTopbarTrack();   // same reason as startRun — restored values aren't "deltas"
  navigateToCurrentPhase();
}

// Render whatever screen state.phase currently indicates. Shared by:
//   • resumeRun (initial page load with a saved run)
//   • the Continue button at the end of a battle animation
// This is what locks in battle outcomes — by the time the animation plays, state.phase
// already points to the *post-battle* screen, so a mid-animation F5 cannot reroll.
function navigateToCurrentPhase() {
  repaint();
  switch (state.phase) {
    case 'starterPick': showStarterPick(); break;
    case 'adventure':   showAdventureStep(); break;
    case 'event':
      // Mid-event refresh — re-dispatch into the same event the player was on.
      // Random rolls inside (wild encounter, trade offer) re-roll on resume; that's
      // an accepted trade-off versus full RNG-state serialization.
      if (state.currentEvent) handleEvent(state.currentEvent);
      else showAdventureStep();
      break;
    case 'preBattle':   showPreBattle(); break;
    case 'town':        startTown(); break;
    case 'ended':       endRun(state.result || 'lost'); break;
    default:            showStarterPick();
  }
}

// Public hook for the options menu — clear save + go back to title.
export function abandonRun() {
  S.clearRun();
  state = null;
  rng = null;
  showTitle();
}

// ─── Phase: starter pick ─────────────────────────────────────────────────
function showStarterPick() {
  const pool = RUN.starterPool.slice().sort(() => rng.float() - 0.5);
  const previews = pool.slice(0, RUN.starterChoices).map(id => S.makeInstance(id, RUN.starterLevel));
  const cards = previews.map(p => `<div class="slot starter-pick" data-id="${p.speciesId}">${pokemonCardInnerHTML(p)}</div>`).join('');
  setPhase(`
    ${phaseHeader(t('starter.title'), t('starter.subtitle'))}
    <div class="starter-grid">${cards}</div>
  `);
  document.querySelectorAll('.starter-pick').forEach(el => {
    el.onclick = () => {
      const id = parseInt(el.dataset.id, 10);
      state.team['F2'] = S.makeInstance(id, RUN.starterLevel);
      repaint();
      save();
      startAdventure();
    };
  });
}

// ─── Phase: adventure ─────────────────────────────────────────────────
function startAdventure() {
  // Daycare return — applies level gains / evolution check in-place on the team slot
  // that the Pokémon never left. Legacy migration path: older saves stored a Pokémon
  // copy in state.daycare and deleted the team slot; we detect that by the presence
  // of a speciesId on state.daycare and fall back to the old slot-into-firstEmpty flow.
  const dc = legacyDaycareReturn() || newDaycareReturn();
  if (dc) repaint();
  state.daycare = null;   // defensive — never leak between adventures
  state.advStep = 0;
  state.pendingStep = null;
  state.phase = 'adventure';
  save();
  showAdventureStep();
}

// New format: Pokémon stayed in its slot tagged inDaycare. Clear the tag, apply gains.
function newDaycareReturn() {
  const slot = S.daycareSlot(state);
  if (!slot) return false;
  const dc = state.team[slot];
  const beforeSpecies = dc.speciesId, beforeLevel = dc.level;
  dc.level = Math.min(100, dc.level + RUN.daycareLevels);
  S.checkEvolve(dc);
  const sp = SPECIES[dc.speciesId];
  const stats = actualStats(sp, dc.level);
  dc.hpMax = stats.hp + (dc.hpBonus || 0);
  dc.atk = stats.atk + (dc.atkBonus || 0);
  dc.spd = stats.spd + (dc.spdBonus || 0);
  dc.hp = dc.hpMax;
  dc.fainted = false;
  dc.inDaycare = false;
  state.daycare = null;
  if (dc.speciesId !== beforeSpecies) queueTeamPopup(slot, t('popup.evolved'), 'evolve');
  else if (dc.level > beforeLevel)   queueTeamPopup(slot, t('popup.levels', dc.level - beforeLevel), 'level');
  return true;
}

// Legacy format: state.daycare was a full Pokémon copy, slot already deleted.
function legacyDaycareReturn() {
  if (!state.daycare || !state.daycare.speciesId) return false;
  const dc = state.daycare;
  const beforeSpecies = dc.speciesId, beforeLevel = dc.level;
  dc.level = Math.min(100, dc.level + RUN.daycareLevels);
  S.checkEvolve(dc);
  const sp = SPECIES[dc.speciesId];
  const stats = actualStats(sp, dc.level);
  dc.hpMax = stats.hp + (dc.hpBonus || 0);
  dc.atk = stats.atk + (dc.atkBonus || 0);
  dc.spd = stats.spd + (dc.spdBonus || 0);
  dc.hp = dc.hpMax;
  dc.fainted = false;
  dc.inDaycare = false;
  const slot = S.firstEmptySlot(state);
  if (slot) {
    state.team[slot] = dc;
    if (dc.speciesId !== beforeSpecies) queueTeamPopup(slot, t('popup.evolved'), 'evolve');
    else if (dc.level > beforeLevel)   queueTeamPopup(slot, t('popup.levels', dc.level - beforeLevel), 'level');
  } else {
    state.money += S.sellValue(dc);
  }
  state.daycare = null;
  return true;
}

// ─── Adventure step dispatcher ───────────────────────────────────────────
// Each zone is 9 steps in 3 sets of 3, fixed order per set:
//   advStep % 3 === 0  →  Capture step  (pick 1 of 2 wilds, or skip → 2 berries)
//   advStep % 3 === 1  →  Trainer step  (pick normal / hard / skip → 2 berries)
//   advStep % 3 === 2  →  Special step  (pick 1 of 2 special events)
// state.pendingStep caches the roll for the current step so refresh doesn't re-roll.
function showAdventureStep() {
  if (state.advStep >= RUN.adventureSteps) { setTopbarStep(null); showPreBattle(); return; }
  state.phase = 'adventure';
  setTopbarStep(state.advStep);
  const stepKind = state.advStep % 3;
  if (stepKind === 0) return showCaptureStep();
  if (stepKind === 1) return showTrainerStep();
  return showSpecialStep();
}

// Step completion helper — consume the cached step data, advance the step counter, save,
// repaint HUD, and reroute to the next step (or to pre-battle if all steps are done).
function completeAdventureStep() {
  state.pendingStep = null;
  state.currentEvent = null;
  state.advStep++;
  save();
  repaint();
  showAdventureStep();
}

// ─── Capture step (kind A) ───────────────────────────────────────────────
// Two distinct wild Pokémon rolled from the zone pool at the step's level. Pick one to
// catch (full team → sold for sellValue gold), or skip → 2 random small berries (subject
// to free slots). Lure item re-rolls both, excluding the species already shown.
function captureLevel() {
  const zone = ZONES[state.zone - 1];
  const bonus = state.zone === 1 ? 2 : state.zone === 2 ? 1 : 0;
  return zone.min + state.advStep + bonus;
}
function rollCaptureStep(excludeIds = []) {
  const zone = ZONES[state.zone - 1];
  const excl = new Set(excludeIds);
  let pool = zone.pool.filter(id => !excl.has(id));
  if (pool.length < 2) pool = zone.pool;          // fallback if exclusion shrunk the pool too far
  const shuffled = pool.slice().sort(() => rng.float() - 0.5);
  const idA = shuffled[0];
  const idB = shuffled.find(id => id !== idA) || shuffled[1] || idA;
  const lvl = captureLevel();
  return {
    kind: 'capture',
    wildA: S.makeInstance(idA, lvl),
    wildB: S.makeInstance(idB, lvl),
    seenIds: [idA, idB],
  };
}
function showCaptureStep() {
  if (!state.pendingStep || state.pendingStep.kind !== 'capture') {
    state.pendingStep = rollCaptureStep();
    save();
  }
  renderCaptureStep();
}
function renderCaptureStep() {
  const step = state.pendingStep;
  const { wildA, wildB } = step;
  const hasLure = S.findItem(state, 'lure') >= 0;
  const slotsFree = S.hasItemSlot(state);
  // Each wild option uses the full Pokémon card layout (the same one as the starter
  // pick and the team manager) so the player can compare stats, types, and ability at
  // a glance before deciding. The skip card matches the slot's footprint with a
  // berry icon + reward summary; disabled state grays it out when item slots are full.
  const wildSlotHtml = (p, key) => `
    <div class="slot capture-pick" data-key="${key}">
      ${pokemonCardInnerHTML(p)}
    </div>`;
  const skipBody = slotsFree
    ? `<div class="capture-skip-reward">${t('capture.skipReward')}</div>`
    : `<div class="capture-skip-reward muted">${t('capture.skipNoSlots')}</div>`;
  // Skip card uses the standard event-card layout (header + full-bleed berry image +
  // reward strip) so the berry sprite reads at a glance, the same way it did before
  // we promoted the wild options to full slot cards.
  const skipSlotHtml = `
    <div class="card event-card capture-skip${slotsFree ? '' : ' disabled'}" data-key="skip">
      <div class="card-header">
        <div class="ctitle">${t('capture.skip')}</div>
        <div class="cdesc"></div>
      </div>
      <div class="card-image">${eventImg('berry', 'oran-berry')}</div>
      ${skipBody}
    </div>`;
  setPhase(`
    ${phaseHeader(t('capture.title'), t('capture.subtitle'))}
    <div class="capture-grid">${wildSlotHtml(wildA, 'A')}${wildSlotHtml(wildB, 'B')}${skipSlotHtml}</div>
    ${hasLure ? `<div style="text-align:center;margin-top:14px;"><button id="btn-capture-lure">${t('capture.lureBtn')}</button></div>` : ''}
  `);
  document.querySelectorAll('.capture-grid [data-key]').forEach(el => {
    el.onclick = () => {
      if (el.classList.contains('disabled')) return;
      const key = el.dataset.key;
      if (key === 'A') catchAndAdvance(state.pendingStep.wildA);
      else if (key === 'B') catchAndAdvance(state.pendingStep.wildB);
      else if (key === 'skip') skipCaptureForBerries();
    };
  });
  if (hasLure) {
    document.querySelector('#btn-capture-lure').onclick = () => {
      const idx = S.findItem(state, 'lure'); S.removeItem(state, idx);
      // Exclude the currently-shown species AND any previous picks from this step's
      // history (Lure used twice in a row shouldn't surface the same Pokémon again).
      const prevSeen = state.pendingStep.seenIds || [];
      state.pendingStep = rollCaptureStep(prevSeen);
      // Carry the cumulative exclusion list forward so subsequent Lures keep excluding.
      state.pendingStep.seenIds = Array.from(new Set([...prevSeen, ...state.pendingStep.seenIds]));
      save(); repaint(); renderCaptureStep();
    };
  }
}
function catchAndAdvance(wild) {
  const free = S.firstEmptySlot(state);
  if (free) {
    state.team[free] = wild;
  } else {
    state.money += S.sellValue(wild);
  }
  completeAdventureStep();
}
function skipCaptureForBerries() {
  // Drop up to captureSkipBerryCount random small berries into free item slots.
  // No-op if the player has no free slots (skip card is disabled in that case so
  // this branch is a defensive guard for keyboard / programmatic clicks).
  const smallIds = ['oranSmall', 'cheriSmall', 'salacSmall'];
  for (let i = 0; i < RUN.captureSkipBerryCount; i++) {
    if (!S.hasItemSlot(state)) break;
    S.addItem(state, smallIds[Math.floor(rng.float() * smallIds.length)]);
  }
  completeAdventureStep();
}

// ─── Trainer step (kind B) ───────────────────────────────────────────────
// Two distinct trainer archetypes rolled from the zone pool. One is offered as Normal,
// the other as Hard. Hard trainer gets +hardTrainerExtraPokemon Pokémon (capped at
// RUN.teamSize=6) and each enemy is +hardTrainerLevelPerZone * state.zone levels above
// the normal level. Win rewards differ by difficulty (trainerWinLevels). Skip card
// drops 2 random small berries the same way the capture step does.
function rollTrainerStep() {
  const pool = TRAINERS[state.zone];
  if (!state.seenTrainers) state.seenTrainers = [];
  const seen = new Set(state.seenTrainers);
  let avail = pool.filter(tr => !seen.has(tr.name));
  if (avail.length < 2) avail = pool;                  // fallback when too few unseen left
  const shuffled = avail.slice().sort(() => rng.float() - 0.5);
  const a = shuffled[0];
  const b = shuffled.find(tr => tr.name !== a.name) || shuffled[1] || a;
  // Mark BOTH as seen this zone — they're both burned regardless of which the player picks.
  state.seenTrainers.push(a.name, b.name);
  return { kind: 'trainer', normal: a, hard: b };
}
function showTrainerStep() {
  if (!state.pendingStep || state.pendingStep.kind !== 'trainer') {
    state.pendingStep = rollTrainerStep();
    save();
  }
  renderTrainerStep();
}
function renderTrainerStep() {
  const step = state.pendingStep;
  const slotsFree = S.hasItemSlot(state);
  const trainerCardHtml = (trainer, difficulty) => {
    const isHard = difficulty === 'hard';
    const c = trainerCardContent(trainer, difficulty);
    return `<div class="card event-card is-trainer trainer-pick trainer-pick-${difficulty}" data-key="${difficulty}">
      <div class="card-header">
        <div class="ctitle">${c.title}</div>
        <div class="cdesc">${c.desc}</div>
      </div>
      <div class="card-image">${c.body}</div>
    </div>`;
  };
  const skipBody = slotsFree
    ? `<div class="capture-skip-reward">${t('trainer.skipReward')}</div>`
    : `<div class="capture-skip-reward muted">${t('capture.skipNoSlots')}</div>`;
  const skipCardHtml = `
    <div class="card event-card capture-skip${slotsFree ? '' : ' disabled'}" data-key="skip">
      <div class="card-header">
        <div class="ctitle">${t('trainer.skip')}</div>
        <div class="cdesc"></div>
      </div>
      <div class="card-image">${eventImg('berry', 'oran-berry')}</div>
      ${skipBody}
    </div>`;
  setPhase(`
    ${phaseHeader(t('trainer.title'), t('trainer.subtitle'))}
    <div class="adventure-trio">
      <div class="adventure-row adventure-row-top">${trainerCardHtml(step.normal, 'normal')}${trainerCardHtml(step.hard, 'hard')}${skipCardHtml}</div>
    </div>
  `);
  document.querySelectorAll('.card[data-key]').forEach(el => {
    el.onclick = () => {
      if (el.classList.contains('disabled')) return;
      const key = el.dataset.key;
      if (key === 'normal') {
        state.currentEvent = { kind: 'trainer', trainer: step.normal, difficulty: 'normal' };
        state.phase = 'event'; save();
        startTrainerBattle(step.normal, 'normal');
      } else if (key === 'hard') {
        state.currentEvent = { kind: 'trainer', trainer: step.hard, difficulty: 'hard' };
        state.phase = 'event'; save();
        startTrainerBattle(step.hard, 'hard');
      } else if (key === 'skip') {
        skipCaptureForBerries();           // identical reward + behavior to capture skip
      }
    };
  });
}
// Build title/desc/body for a trainer pick card. Body shows the roster preview at the
// scaled level (hard difficulty rolls the roster +1 size and +zone levels per Pokémon).
function trainerCardContent(trainer, difficulty) {
  const zone = ZONES[state.zone - 1];
  const isHard = difficulty === 'hard';
  const normalLevel = zone.min + 1 + state.advStep + state.zone;
  const trainerLevel = normalLevel + (isHard ? RUN.hardTrainerLevelPerZone * state.zone : 0);
  // Hard adds extraPokemon to size, capped at teamSize. Pool may not have that many
  // entries — fall back to repeating the last entry so the size still grows visibly.
  const baseSize = trainer.size;
  const size = Math.min(RUN.teamSize, baseSize + (isHard ? RUN.hardTrainerExtraPokemon : 0));
  const ids = [];
  for (let i = 0; i < size; i++) ids.push(trainer.pool[i] != null ? trainer.pool[i] : trainer.pool[trainer.pool.length - 1]);
  const sprites = ids.map(id => {
    const evoId = evolvedAt(id, trainerLevel);
    const sp = SPECIES[evoId];
    return `<img src="${SPRITE_URL(evoId)}" class="trainer-preview-sprite" alt="${sp.name}" title="${sp.name} L${trainerLevel}" loading="lazy">`;
  }).join('');
  const FALLBACK_TRAINERS = ['youngster','lass','hiker','bugcatcher','fisherman','sailor','beauty','birdkeeper','blackbelt','psychic'];
  let h = 0;
  for (const c of (trainer.name || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  const fallbackSlug = FALLBACK_TRAINERS[Math.abs(h) % FALLBACK_TRAINERS.length];
  const fallbackSrc  = TRAINER_SPRITE_URL(fallbackSlug);
  const trainerImg = trainer.sprite
    ? `<img src="${TRAINER_SPRITE_URL(trainer.sprite)}" class="event-image trainer-event-sprite" alt="${trainer.name}" loading="lazy" onerror="this.onerror=function(){this.style.display='none'};this.src='${fallbackSrc}'">`
    : '';
  const title = isHard ? t('trainer.hard.title') : t('trainer.normal.title');
  const desc = isHard
    ? t('trainer.hard.subtitle', RUN.trainerWinLevels.hard, RUN.hardTrainerExtraPokemon, RUN.hardTrainerLevelPerZone * state.zone)
    : t('trainer.normal.subtitle', RUN.trainerWinLevels.normal);
  return {
    title: `${title} — ${trainer.name}`,
    desc,
    body: `${trainerImg}<div class="trainer-preview">${sprites}</div>`,
  };
}

// ─── Special step (kind C) ───────────────────────────────────────────────
// Pick 1 of 2 distinct special events from {berry, trade, job, daycare, lostStash,
// wildHorde}. Same forbidden-by-state gating as the old special slot. The two picks
// can NEVER be the same kind. No skip option here — special steps always fire.
const SPECIAL_KINDS = ['berry', 'trade', 'job', 'daycare', 'lostStash', 'wildHorde'];
function rollSpecialStep() {
  const forbidden = new Set();
  if (S.teamCount(state) <= 1) { forbidden.add('trade'); forbidden.add('daycare'); }
  if (S.daycareSlot(state))    forbidden.add('daycare');
  if (!S.hasItemSlot(state))   forbidden.add('lostStash');
  let pool = SPECIAL_KINDS.filter(k => !forbidden.has(k));
  if (pool.length < 2) pool = SPECIAL_KINDS;          // ungate everything as a last resort
  const shuffled = pool.slice().sort(() => rng.float() - 0.5);
  const make = (kind) => {
    if (kind === 'wildHorde') {
      const zonePool = ZONES[state.zone - 1].pool;
      return { kind, species: zonePool[Math.floor(rng.float() * zonePool.length)] };
    }
    return { kind };
  };
  return { kind: 'special', a: make(shuffled[0]), b: make(shuffled[1] || shuffled[0]) };
}
function showSpecialStep() {
  if (!state.pendingStep || state.pendingStep.kind !== 'special') {
    state.pendingStep = rollSpecialStep();
    save();
  }
  const step = state.pendingStep;
  const cardHtml = (ev, key) => {
    const c = eventCardContent(ev);
    const kindCls = (ev.kind === 'wildHorde') ? ' is-wild' : '';
    return `<div class="card event-card${kindCls}" data-key="${key}">
      <div class="card-header">
        <div class="ctitle">${c.title}</div>
        <div class="cdesc">${c.desc}</div>
      </div>
      <div class="card-image">${c.body}</div>
    </div>`;
  };
  setPhase(`
    ${phaseHeader(t('special.title'), t('special.subtitle'))}
    <div class="adventure-trio">
      <div class="adventure-row adventure-row-top">${cardHtml(step.a, 'a')}${cardHtml(step.b, 'b')}</div>
    </div>
  `);
  document.querySelectorAll('.card[data-key]').forEach(el => {
    el.onclick = () => {
      if (el.classList.contains('disabled')) return;
      const ev = el.dataset.key === 'a' ? step.a : step.b;
      handleEvent(ev);
    };
  });
}
// Auto-evolve a species id to the form it would take at the given level.
function evolvedAt(speciesId, level) {
  let id = speciesId;
  let sp = SPECIES[id];
  while (sp && sp.evolvesTo && sp.evolvesAt && level >= sp.evolvesAt) {
    id = sp.evolvesTo;
    sp = SPECIES[id];
  }
  return id;
}

// Tries the user-supplied local image at /assets/events/{kind}.png first; on 404, falls
// back to the PokéAPI item icon below so the card never goes blank during development.
// Filenames on disk are all-lowercase (Linux servers are case-sensitive), so we lowercase
// the kind here even though canonical event ids like 'pokeCenter' use camelCase.
function eventImg(kind, fallbackSlug) {
  const local = `assets/events/${(kind || '').toLowerCase()}.png`;
  const fallback = ITEM_ICON_URL(fallbackSlug);
  return `<img src="${local}" class="event-image" loading="lazy" alt=""
               onerror="this.onerror=null;this.src='${fallback}';">`;
}

// Title + short description + image for special-event cards rendered by showSpecialStep.
// (Capture and trainer steps build their own cards directly — see renderCaptureStep /
// renderTrainerStep — because they need step-specific visuals like the wild Pokémon
// sprite and the normal/hard split.)
function eventCardContent(ev) {
  switch (ev.kind) {
    case 'berry':
      return { title: t('event.berry.title'),      desc: t('event.berry.desc'),               body: eventImg('berry', 'oran-berry') };
    case 'trade':
      return { title: t('event.trade.title'),      desc: t('event.trade.desc'),               body: eventImg('trade', 'link-cable') };
    case 'job':
      return { title: t('event.job.title'),        desc: t('event.job.desc', RUN.jobReward),  body: eventImg('job', 'amulet-coin') };
    case 'daycare':
      return { title: t('event.daycare.title'),    desc: t('event.daycare.desc', RUN.daycareLevels), body: eventImg('daycare', 'lucky-egg') };
    case 'lostStash':
      return { title: t('event.lostStash.title'),  desc: t('event.lostStash.desc'),           body: eventImg('lostStash', 'amulet-coin') };
    case 'wildHorde': {
      // Same `wild-preview` row as the regular Wild Pokémon card (so the `.is-wild`
      // background art carries over), but with the rolled species repeated six times.
      // ev.species is pre-rolled at rollEventPair time; fall back to the zone's first
      // pool entry if a stale-format cached event makes it here without one (the
      // migration guard above will replace it on the next step anyway).
      const zone = ZONES[state.zone - 1];
      const bonus = state.zone === 1 ? 2 : state.zone === 2 ? 1 : 0;
      const level = zone.min + state.advStep + bonus;
      const speciesId = ev.species || zone.pool[0];
      const evolvedId = evolvedAt(speciesId, level);
      const sp = SPECIES[evolvedId];
      if (!sp) {
        return { title: t('event.wildHorde.title'), desc: t('event.wildHorde.desc'), body: '' };
      }
      const sprites = Array(6).fill(0).map(() =>
        `<img src="${SPRITE_URL(evolvedId)}" class="wild-preview-sprite" alt="${sp.name}" title="${sp.name} L${level}" loading="lazy">`
      ).join('');
      return {
        title: t('event.wildHorde.title'),
        desc:  t('event.wildHorde.descSpecific', sp.name),
        body:  `<div class="wild-preview">${sprites}</div>`,
      };
    }
    default:
      return { title: '?', desc: '', body: '' };
  }
}

function handleEvent(ev) {
  // Commit the chosen event before dispatching so a refresh while inside the event
  // (e.g. on the Berry Gathering screen) resumes back into that event instead of
  // sending the player to the adventure choice screen. Special-step events and the
  // trainer step both go through here; capture step's state lives in pendingStep
  // and never sets currentEvent, so it naturally resumes via showAdventureStep.
  state.phase = 'event';
  state.currentEvent = ev;
  save();
  if (ev.kind === 'trainer')    { startTrainerBattle(ev.trainer, ev.difficulty || 'normal'); return; }
  if (ev.kind === 'berry')      { startBerryEvent(); return; }
  if (ev.kind === 'trade')      { startTradeEvent(); return; }
  if (ev.kind === 'job')        { startJobEvent(); return; }
  if (ev.kind === 'daycare')    { startDaycareEvent(); return; }
  if (ev.kind === 'lostStash')  { startLostStashEvent(); return; }
  if (ev.kind === 'wildHorde')  { startWildHordeEvent(); return; }
}

// (Wild encounter screen removed — capture is now handled in renderCaptureStep with
// the two-pick / skip card layout. Old startWildEncounter / renderWildEncounter
// functions were deleted with the adventure-flow rework.)

// Trainer battle
//
// Trainer rosters use ability-aware slot layouts — the order of Pokémon in `trainer.pool`
// IS the placement order. Index 0 sits in the most "front" slot, last index sits furthest
// back. Per-size layouts below let data.js declare positional intent (tank → damage →
// passive) without an extra `slot` field per entry:
//   size 2 → [F2, B2]            1 tank front-center, 1 damage back-center (same column)
//   size 3 → [F1, F2, B2]        2 tanks front + 1 back; F2 protects B2; F1↔F2 adjacency
//   size 4 → [F1, F2, B1, B2]    2×2 formation; both columns protected; row-pair adjacency
//   size 5+ falls back to the legacy F1..F3 / B1..B3 fill order.
const TRAINER_LAYOUTS = {
  2: ['F2', 'B2'],
  3: ['F1', 'F2', 'B2'],
  4: ['F1', 'F2', 'B1', 'B2'],
};
function trainerSlot(i, size) {
  const layout = TRAINER_LAYOUTS[size];
  if (layout && layout[i]) return layout[i];
  return i < 3 ? 'F' + (i + 1) : 'B' + (i - 2);
}

function startTrainerBattle(trainer, difficulty = 'normal') {
  const zone = ZONES[state.zone - 1];
  // Base level uses the same formula as the old single-difficulty version. Hard adds
  // hardTrainerLevelPerZone × state.zone per Pokémon, so Z1 hard = +1 lvl, Z7 hard = +7.
  const isHard = difficulty === 'hard';
  const normalLevel  = zone.min + 1 + state.advStep + state.zone;
  const trainerLevel = normalLevel + (isHard ? RUN.hardTrainerLevelPerZone * state.zone : 0);
  // Hard adds +hardTrainerExtraPokemon to roster size, capped at RUN.teamSize. Pool
  // may not have that many distinct entries — repeat the last one in that case so the
  // roster still visibly grows.
  const baseSize = trainer.size;
  const size = Math.min(RUN.teamSize, baseSize + (isHard ? RUN.hardTrainerExtraPokemon : 0));
  const rosterIds = [];
  for (let i = 0; i < size; i++) rosterIds.push(trainer.pool[i] != null ? trainer.pool[i] : trainer.pool[trainer.pool.length - 1]);
  const roster = rosterIds.map((id, i) => ({
    speciesId: id, level: trainerLevel, slot: trainerSlot(i, size),
  }));
  // Auto-evolve roster pokemon to fit level
  for (const m of roster) {
    let sp = SPECIES[m.speciesId];
    while (sp && sp.evolvesTo && sp.evolvesAt && m.level >= sp.evolvesAt) { m.speciesId = sp.evolvesTo; sp = SPECIES[m.speciesId]; }
  }
  const label = isHard
    ? `${t('battle.trainerLabel', trainer.name)} — ${t('trainer.hard.title')}`
    : t('battle.trainerLabel', trainer.name);
  runBattle(roster, label, (result) => {
    if (result.winner === 'A') {
      // Win: money + difficulty-tiered XP. No berry drop anymore — the choice itself
      // (and the level reward) is the reward.
      state.money += RUN.trainerWinMoney;
      const xp = isHard ? RUN.trainerWinLevels.hard : RUN.trainerWinLevels.normal;
      grantTeamExpWithPopups(xp);
    }
    // After every battle the team is fully restored — no fainted persistence anymore,
    // so the player walks into the next step with a clean slate. Trainer losses still
    // do NOT cost a strike (only gym leader and PvP losses do).
    S.healAll(state);
    // Pre-stage the post-battle phase so a mid-animation refresh resumes cleanly.
    state.pendingStep   = null;
    state.currentEvent  = null;
    state.advStep++;
    state.phase = 'adventure';
  });
}

// Berry gathering
function startBerryEvent() {
  if (!S.hasItemSlot(state)) {
    setPhase(`${phaseHeader(t('event.berry.title'), t('berry.fullSlots'))}
      <div class="message">${t('berry.continue')}</div><div style="text-align:center"><button class="primary" id="btn-cont">${t('berry.skip')}</button></div>`);
    document.querySelector('#btn-cont').onclick = () => completeAdventureStep();
    return;
  }
  // Berry Gathering event only offers the full-size berries — small berries are an
  // exclusive drop from choosing to battle (not catch) a wild Pokémon.
  const cards = Object.values(BERRIES).filter(b => !b.small).map(b => {
    const iconUrl = itemIcon(b.id);
    const localizedName = t('berry.' + b.id + '.name');
    const statLabel = t('stat.' + b.stat);
    return `<div class="card berry-pick" data-id="${b.id}">
      <div class="berry-pick-info">
        <div class="ctitle">${localizedName}</div>
        <div class="csub">+20 ${statLabel}</div>
      </div>
      ${iconUrl ? `<img src="${iconUrl}" alt="${localizedName}" class="berry-pick-icon" loading="lazy">` : ''}
    </div>`;
  }).join('');
  setPhase(`${phaseHeader(t('event.berry.title'), t('berry.pickPrompt'))}
    <div class="berry-choices">${cards}</div>`);
  document.querySelectorAll('.card').forEach(el => {
    el.onclick = () => {
      S.addItem(state, el.dataset.id); repaint();
      completeAdventureStep();
    };
  });
}

// Trading
function startTradeEvent() {
  if (S.teamCount(state) <= 1) {
    setPhase(`${phaseHeader(t('event.trade.title'), t('trade.fullSlots'))}
      <div style="text-align:center"><button class="primary" id="btn-cont">${t('berry.skip')}</button></div>`);
    document.querySelector('#btn-cont').onclick = () => completeAdventureStep();
    return;
  }
  // Offered level = zone.min + 1 + step number (1-indexed). state.advStep is 0-indexed, so + 2 + state.advStep.
  const zone = ZONES[state.zone - 1];
  const offeredLevel = zone.min + 2 + state.advStep;
  // Cache the offered Pokémon on state.currentEvent so a refresh mid-trade doesn't
  // reroll it. Trade Card reroll updates this same field (see below).
  if (!state.currentEvent.offered) {
    // Trade pool spans the current zone AND the next zone — Pokémon comes at this zone's level.
    state.currentEvent.offered = S.rollWild(state, rng, { level: offeredLevel, tradeMix: true });
    save();
  }
  let offered = state.currentEvent.offered;
  const render = () => {
    setPhase(`${phaseHeader(t('event.trade.title'), t('trade.subtitle'))}
      <div class="trade-stage">
        <div class="trade-side">
          <div class="phase-subtitle">${t('trade.yourOffer')}</div>
          <div class="trade-dropzone" id="trade-drop">${t('trade.dropHere')}</div>
        </div>
        <div class="trade-arrow">⇄</div>
        <div class="trade-side">
          <div class="phase-subtitle">${t('trade.trainerOffer')}</div>
          <div class="slot display">${pokemonCardInnerHTML(offered)}</div>
        </div>
      </div>
      <div style="text-align:center;margin-top:14px;">
        <button id="btn-decline">${t('trade.decline')}</button>
        ${S.findItem(state, 'tradeCard') >= 0 ? `<button id="btn-reroll">${t('trade.reroll')}</button>` : ''}
      </div>`);

    // Drop handler — accepts a {type:'pokemon', slot} payload from the bottom-bar team display.
    const drop = document.querySelector('#trade-drop');
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault(); drop.classList.remove('drag-over');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type !== 'pokemon') return;
        const slot = data.slot;
        const trading = state.team[slot];
        if (!trading) return;
        if (trading.inDaycare) return;       // can't trade away a Pokémon at daycare
        delete state.team[slot];
        const targetSlot = S.firstEmptySlot(state) || slot;
        state.team[targetSlot] = offered;
        completeAdventureStep();
      } catch {}
    });

    document.querySelector('#btn-decline').onclick = () => completeAdventureStep();
    if (document.querySelector('#btn-reroll')) {
      document.querySelector('#btn-reroll').onclick = () => {
        const idx = S.findItem(state, 'tradeCard'); S.removeItem(state, idx);
        offered = S.rollWild(state, rng, { level: offeredLevel, tradeMix: true });
        // Persist the new offer so a refresh doesn't waste the Trade Card item.
        state.currentEvent.offered = offered;
        render(); repaint();
      };
    }
  };
  render();
}

// Part-Time Job
function startJobEvent() {
  setPhase(`${phaseHeader(t('event.job.title'), t('job.intro'))}
    <div style="text-align:center;padding:40px 20px;">
      <div style="font-size:42px;color:var(--accent-deep);font-weight:800;margin-bottom:24px;">+$${RUN.jobReward}</div>
      <button class="primary" id="btn-collect">${t('job.collect')}</button>
    </div>`);
  document.querySelector('#btn-collect').onclick = () => {
    state.money += RUN.jobReward;
    completeAdventureStep();
  };
}

// Daycare — drop a Pokémon, it returns next adventure phase with +N levels
function startDaycareEvent() {
  setPhase(`${phaseHeader(t('event.daycare.title'), t('daycare.subtitle', RUN.daycareLevels))}
    <div class="trade-stage" style="grid-template-columns: 1fr;">
      <div class="trade-side">
        <div class="phase-subtitle">${t('daycare.slotLabel')}</div>
        <div class="trade-dropzone" id="daycare-drop">${t('daycare.dropPrompt')}</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:14px;">
      <button id="btn-skip">${t('daycare.skip')}</button>
    </div>`);

  const drop = document.querySelector('#daycare-drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('drag-over');
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.type !== 'pokemon') return;
      const p = state.team[data.slot];
      if (!p) return;
      if (p.inDaycare) return;                   // shouldn't happen — daycare slots aren't draggable
      if (S.teamCount(state) <= 1) return;
      // Tag the Pokémon in-place — it keeps its slot but is locked out of battle / interactions
      // until the next adventure starts. state.daycare remembers the slot for quick lookup
      // (and so the legacy-save migration path in startAdventure stays simple).
      p.inDaycare = true;
      state.daycare = { slot: data.slot };
      completeAdventureStep();
    } catch {}
  });

  document.querySelector('#btn-skip').onclick = () => completeAdventureStep();
}

// PokeCenter
// (PokéCenter retired — teams now heal fully after every battle, so the on-card heal
// event has nothing to do. The handler was removed; the i18n keys stay around in case
// they ever get repurposed.)

// Lost Stash — pick 1 of 3 random items. Choices are cached on state.currentEvent so a
// refresh mid-event doesn't reroll the offers. Forbidden-by-state rule in rollEventPair
// already gates the event behind hasItemSlot(state), so we don't need to re-check here.
function startLostStashEvent() {
  if (!state.currentEvent.stashItems) {
    const pool = Object.keys(ITEMS);
    // Shuffle then take 3 distinct ids.
    const shuffled = pool.slice().sort(() => rng.float() - 0.5);
    state.currentEvent.stashItems = shuffled.slice(0, 3);
    save();
  }
  const ids = state.currentEvent.stashItems;
  const cards = ids.map((id) => {
    const def = ITEMS[id];
    const iconUrl = itemIcon(id);
    return `<div class="card stash-item" data-item="${id}">
      <div class="item-icon-wrap">${iconUrl ? `<img src="${iconUrl}" alt="${def.name}" loading="lazy">` : ''}</div>
      <div class="name">${def.name}</div>
      <div class="cost">${itemTooltip(id) || ''}</div>
    </div>`;
  }).join('');
  setPhase(`${phaseHeader(t('event.lostStash.title'), t('lostStash.subtitle'))}
    <div class="choices stash-choices">${cards}</div>
  `);
  document.querySelectorAll('.card.stash-item').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.item;
      S.addItem(state, id);
      completeAdventureStep();
    };
  });
}

// Wild Horde — six instances of the same wild species from the current zone's pool.
// Win → team gets +3 levels. Loss → −1 strike, same as a trainer loss.
function startWildHordeEvent() {
  const zone = ZONES[state.zone - 1];
  // Species was pre-rolled at rollEventPair time and lives on state.currentEvent.species
  // — that's also what the adventure card preview used, so the card and the battle stay
  // in sync. Fallback rolls a fresh species in the unlikely event the field is missing.
  if (!state.currentEvent.species) {
    state.currentEvent.species = zone.pool[Math.floor(rng.float() * zone.pool.length)];
    save();
  }
  // Level uses the same formula as a normal wild encounter at this step (Z1 +2, Z2 +1).
  const bonus = state.zone === 1 ? 2 : state.zone === 2 ? 1 : 0;
  const baseLevel = zone.min + state.advStep + bonus;
  const speciesId = state.currentEvent.species;
  // Auto-evolve preview species to whatever it'd actually be at fight time.
  const evolvedId = evolvedAt(speciesId, baseLevel);
  const sp = SPECIES[evolvedId];
  const sprites = Array(6).fill(0).map(() =>
    `<img src="${SPRITE_URL(evolvedId)}" class="prebattle-preview-sprite" alt="${sp.name}" title="${sp.name} L${baseLevel}" loading="lazy">`
  ).join('');
  setPhase(`${phaseHeader(t('event.wildHorde.title'), t('event.wildHorde.intro', sp.name))}
    <div class="prebattle-preview">${sprites}</div>
    <div style="text-align:center;margin-top:24px;">
      <button class="primary" id="btn-horde-fight" style="font-size:18px;padding:14px 32px;margin-right:12px;">${t('wildHorde.fight')}</button>
      <button id="btn-horde-run">${t('wildHorde.run')}</button>
    </div>
  `);
  document.querySelector('#btn-horde-run').onclick = () => completeAdventureStep();
  document.querySelector('#btn-horde-fight').onclick = () => {
    // Six of the same species filling every enemy slot. Auto-evolve here too in case
    // baseLevel crosses an evolution threshold.
    const roster = ['F1','F2','F3','B1','B2','B3'].map(slot => {
      let id = speciesId;
      let curSp = SPECIES[id];
      while (curSp && curSp.evolvesTo && curSp.evolvesAt && baseLevel >= curSp.evolvesAt) {
        id = curSp.evolvesTo;
        curSp = SPECIES[id];
      }
      return { speciesId: id, level: baseLevel, slot };
    });
    runBattle(roster, t('battle.hordeLabel', sp.name), (result) => {
      if (result.winner === 'A') {
        grantTeamExpWithPopups(RUN.wildHordeLevels);   // smaller XP now — see RUN constants
      }
      // Always heal fully after a battle — no fainted persistence anymore. Horde
      // losses still don't cost a strike (only gym leader and PvP do).
      S.healAll(state);
      // Inline equivalent of completeAdventureStep so a mid-animation refresh resumes
      // cleanly into the next step.
      state.pendingStep   = null;
      state.currentEvent  = null;
      state.advStep++;
      state.phase = 'adventure';
    });
  };
}

// ─── Pre-battle setup — last chance to reorganize team / use items ────────
function showPreBattle() {
  state.phase = 'preBattle';
  state.pendingStep = null;
  save();
  const zone = ZONES[state.zone - 1];

  // Helper to render an opponent roster preview the same way for both gym and PvP.
  const rosterPreview = (roster) => roster.map(m => {
    const id = evolvedAt(m.speciesId, m.level);
    const sp = SPECIES[id];
    return `<img src="${SPRITE_URL(id)}" class="prebattle-preview-sprite" alt="${sp.name}" title="${sp.name} L${m.level}" loading="lazy">`;
  }).join('');

  if (state.mode === 'singleplayer') {
    const leaderName = Object.keys(GYM_LEADERS)[state.zone - 1];
    const leader = GYM_LEADERS[leaderName];
    // Build the gym leader's roster the same way startBattle does so the preview
    // matches exactly: zone.level + m.lvl + state.zone difficulty bump.
    const roster = leader.pool.map(m => ({
      speciesId: m.id, level: zone.level + (m.lvl || 0) + state.zone,
    }));
    const opponentHtml = `
      <div style="font-size:22px;font-weight:800;color:var(--accent-deep);margin:8px 0;">${t('preBattle.gymLeader', leaderName)}</div>
      <div class="prebattle-preview">${rosterPreview(roster)}</div>
    `;
    setPhase(`
      <div style="text-align:center;padding:20px;">
        ${opponentHtml}
        <button class="primary" id="btn-go-battle" style="margin-top:28px;font-size:18px;padding:14px 32px;">${t('preBattle.enter')}</button>
      </div>
    `);
    document.querySelector('#btn-go-battle').onclick = () => startBattle();
    return;
  }

  // Ranked PvP — show a "Matchmaking…" loading state, resolve the opponent (server
  // → local snapshot pool → gym-leader ghost), cache the result on state so the
  // actual battle uses the SAME opponent the preview promised, then swap in the
  // roster preview and enable the Enter Battle button. Cached lookup short-circuits
  // a refresh during pre-battle from re-rolling the matchup.
  const renderRanked = (label, roster, enabled) => {
    const previewHtml = roster ? `<div class="prebattle-preview">${rosterPreview(roster)}</div>` : '';
    setPhase(`
      <div style="text-align:center;padding:20px;">
        <div style="font-size:22px;font-weight:800;color:var(--accent-deep);margin:8px 0;">${label}</div>
        ${previewHtml}
        <button class="primary" id="btn-go-battle" ${enabled ? '' : 'disabled'} style="margin-top:28px;font-size:18px;padding:14px 32px;">${enabled ? t('preBattle.enter') : t('preBattle.matchmaking')}</button>
      </div>
    `);
    const btn = document.querySelector('#btn-go-battle');
    if (enabled) btn.onclick = () => startBattle();
  };

  if (state.rankedOpponent && state.rankedOpponent.roster) {
    // Resume case — opponent was matched before a refresh; reuse it.
    renderRanked(t('preBattle.vs', state.rankedOpponent.opponentName), state.rankedOpponent.roster, true);
    return;
  }

  // Initial render — show searching state, then matchmake.
  renderRanked(t('preBattle.matchmaking'), null, false);
  (async () => {
    let resolved = null;
    try {
      const { api } = await import('./api.js');
      const m = await api.matchPvp(state);
      if (m && m.roster && m.roster.length) resolved = { roster: m.roster, opponentName: m.opponentName || 'Ghost' };
    } catch (e) { /* server unavailable — fall through */ }
    if (!resolved) {
      const local = findLocalMatch(state);
      if (local) resolved = { roster: local.roster, opponentName: local.opponentName };
    }
    if (!resolved) {
      // Last-resort gym-leader ghost — keep the same level formula as singleplayer.
      const leaderName = Object.keys(GYM_LEADERS)[state.zone - 1];
      const leader = GYM_LEADERS[leaderName];
      const roster = leader.pool.map((m, i) => ({
        speciesId: m.id, level: zone.level + (m.lvl || 0) + state.zone,
        slot: i < 3 ? 'F' + (i+1) : 'B' + (i - 2),
      }));
      resolved = { roster, opponentName: t('preBattle.gymLeader', leaderName) };
    }
    // Guard against the player navigating away mid-resolution (e.g. refresh during
    // matchmaking moved them somewhere else) — only render if we're still on preBattle.
    if (state.phase !== 'preBattle') return;
    state.rankedOpponent = resolved;
    save();
    renderRanked(t('preBattle.vs', resolved.opponentName), resolved.roster, true);
  })();
}

// ─── Battle (PvP / gym leader) ────────────────────────────────────────────
function startBattle() {
  if (state.mode === 'singleplayer') {
    const leaderName = Object.keys(GYM_LEADERS)[state.zone - 1];
    const leader = GYM_LEADERS[leaderName];
    const zone = ZONES[state.zone - 1];
    // Gym leader level = zone.level + m.lvl + state.zone. Per-Pokémon `m.lvl` offsets are
    // already in the data (e.g. Lt. Surge's Raichu has +4); the trailing +state.zone is
    // the same difficulty bump applied to adventure trainers.
    const roster = leader.pool.map((m, i) => ({
      speciesId: m.id, level: zone.level + (m.lvl || 0) + state.zone,
      slot: i < 3 ? 'F' + (i+1) : 'B' + (i - 2),
    }));
    // Auto-evolve
    for (const m of roster) {
      let sp = SPECIES[m.speciesId];
      while (sp && sp.evolvesTo && sp.evolvesAt && m.level >= sp.evolvesAt) { m.speciesId = sp.evolvesTo; sp = SPECIES[m.speciesId]; }
    }
    runBattle(roster, t('battle.gymLabel', leaderName), onBattleResult);
  } else {
    // Ranked mode — try server. Fallback to gym leader.
    startRankedBattle();
  }
}

async function startRankedBattle() {
  // Matchmaking now happens in showPreBattle so the player can see (and prep against)
  // the opponent before clicking Enter Battle. By the time this function runs, the
  // opponent is cached on state.rankedOpponent — use it directly. If for some reason
  // it's missing (legacy save without the cache, or a coding regression), fall back
  // to the same priority chain matchmaking inline.
  if (state.rankedOpponent && state.rankedOpponent.roster) {
    const { roster, opponentName } = state.rankedOpponent;
    runBattle(roster, t('preBattle.vs', opponentName), onBattleResult);
    return;
  }
  setPhase(`${phaseHeader(t('preBattle.matchmaking'), '')}<div class="message">${t('battle.searching')}</div>`);
  try {
    const { api } = await import('./api.js');
    const m = await api.matchPvp(state);
    if (m && m.roster && m.roster.length) {
      runBattle(m.roster, `vs ${m.opponentName || 'Ghost'}`, onBattleResult);
      return;
    }
  } catch (e) { /* server unavailable */ }
  const local = findLocalMatch(state);
  if (local) {
    runBattle(local.roster, `vs ${local.opponentName}`, onBattleResult);
    return;
  }
  // Cold-start fallback: gym-leader ghost with the singleplayer level formula.
  const leaderName = Object.keys(GYM_LEADERS)[state.zone - 1];
  const leader = GYM_LEADERS[leaderName];
  const zone = ZONES[state.zone - 1];
  const roster = leader.pool.map((m, i) => ({
    speciesId: m.id, level: zone.level + (m.lvl || 0) + state.zone,
    slot: i < 3 ? 'F' + (i+1) : 'B' + (i - 2),
  }));
  runBattle(roster, t('preBattle.vs', t('preBattle.gymLeader', leaderName)), onBattleResult);
}

// Gym / PvP applyResults — runs synchronously before the animation, mutates the run state,
// and pre-stages state.phase so the post-animation Continue button (and any mid-animation
// page refresh) lands the player on the correct screen.
function onBattleResult(result) {
  // Drop the cached ranked opponent so the next pre-battle screen rolls a fresh match.
  // Singleplayer doesn't use this field; the assignment is a no-op there.
  state.rankedOpponent = null;
  if (result.winner === 'A') {
    // Wins grant +2 team levels and the badge. No money — gym leaders and PvP wins are
    // explicitly $0 reward; the player earns through trainer wins, jobs, and selling.
    grantTeamExpWithPopups(2);
    state.badges++;
    if (state.badges >= RUN.badgesToWin) {
      state.runOver = true; state.result = 'won'; state.phase = 'ended';
      return;
    }
  } else {
    // Losses cost a strike and grant no XP (was previously +2 either way, which made
    // losses oddly rewarding).
    state.strikes--;
    if (state.strikes <= 0) {
      state.runOver = true; state.result = 'lost'; state.phase = 'ended';
      return;
    }
  }
  S.healAll(state);
  state.phase = 'town';
}

// `applyResults(result)` runs synchronously *before* the animation starts and is the only
// place where post-battle state mutations happen — rewards/strikes/badges/XP/healing and
// (critically) advancing `state.phase` to the post-battle screen. After applyResults the
// state is saved, then the animation is shown purely as a spectator view. If the player
// refreshes mid-animation, the on-disk state already reflects the post-battle world and the
// auto-resume jumps directly to the next screen — they can't reroll the battle by retrying.
function runBattle(opponentRoster, opponentLabel, applyResults) {
  // Filter out Pokémon currently at daycare — they're still occupying a team slot in the UI
  // but they're "away training" and don't deploy for this battle. If the player sent their
  // strongest to daycare, that's a strategic risk on their part.
  const entries = Object.entries(state.team).filter(([_, p]) => !p.inDaycare);
  const myRoster = entries.map(([slot, p]) => ({
    speciesId: p.speciesId, level: p.level, slot,
    hpBonus: p.hpBonus, atkBonus: p.atkBonus, spdBonus: p.spdBonus,
    type1: p.type1, type2: p.type2, abilityOverride: p.ability,
    fainted: !!p.fainted,                    // carry pre-fight fainted state into the battle
  }));
  // Apply X-Vitamin transient buff
  for (const e of myRoster) {
    const live = state.team[e.slot];
    if (live.xVitamin) {
      e.hpBonus = (e.hpBonus || 0) + Math.floor((SPECIES[e.speciesId].hp * e.level / 20 + e.level) * 0.5);
      e.atkBonus = (e.atkBonus || 0) + Math.floor((SPECIES[e.speciesId].atk * e.level / 50 + 2) * 0.5);
      e.spdBonus = (e.spdBonus || 0) + Math.floor((SPECIES[e.speciesId].spd * e.level / 50 + 2) * 0.5);
      live.xVitamin = false;
    }
  }
  const teamA = buildTeam(myRoster, 'A');
  const teamB = buildTeam(opponentRoster, 'B');
  // Snapshot initial unit state for the animation — preserve current HP and fainted
  // (so pre-fainted Pokémon are rendered greyed out from the start instead of "popping" alive).
  const snapshot = (team) => team.units.map(u => ({
    _uid: u._uid, side: u.side, slot: u.slot,
    speciesId: u.species.id, name: u.name, level: u.level, stage: u.species.stage,
    hp: u.hp, hpMax: u.hpMax, atk: u.atk, spd: u.spd,
    abilityId: u.abilityId, type1: u.type1, type2: u.type2,
    burn: 0, poison: 0, stun: 0, fainted: u.fainted,
    dmgDealt: 0,                              // running per-unit "damage caused" total — incremented by hit/heal/rest/revive events
  }));
  const animA = snapshot(teamA);
  const animB = snapshot(teamB);
  const battleSeed = (state.seed + state.zone * 7919) | 0;
  const result = simulate(teamA, teamB, battleSeed);
  // Apply post-battle by original index (slot may have changed via Run Away, but pairing is stable).
  for (let i = 0; i < entries.length; i++) {
    const [origSlot, p] = entries[i];
    const post = teamA.units[i];
    if (!post) continue;
    p.fainted = post.fainted;
    p.hp = post.fainted ? 0 : Math.max(1, Math.min(p.hpMax, Math.floor(post.hp)));
  }
  // Lock in the outcome BEFORE the animation: apply rewards/strikes/etc. and pre-stage
  // state.phase so a refresh during the animation resumes on the post-battle screen.
  applyResults(result);
  save();
  // Animation is purely a spectator view now — Continue just navigates to whichever
  // post-battle phase applyResults pre-staged.
  showBattleAnimation(animA, animB, result, opponentLabel, () => navigateToCurrentPhase());
}

// Progressive battle animation. Pre-battle inspect → Start Battle → animated playback.
// Replays the log entry-by-entry with timing, HP bar tweens, flashes, shakes, damage popups, ability shouts.
// Gen-1 physical types — these use a melee leap-and-tackle animation.
// All other types are "special" and use a particle projectile.
const PHYSICAL_TYPES = new Set(['normal','fighting','poison','ground','flying','bug','rock','ghost']);
const isPhysical = (type) => PHYSICAL_TYPES.has(type || 'normal');


function showBattleAnimation(snapA, snapB, result, opponentLabel, callback) {
  // Hide the team manager (bottom bar) so the player can't reorder/sell mid-fight.
  // It's restored by repaint() in the post-battle callback path.
  document.querySelector('#bottombar').classList.add('hidden');

  // snapA and snapB are arrays of unit snapshots
  const dispA = { side: 'A', units: snapA };
  const dispB = { side: 'B', units: snapB };
  const byUid = {};
  for (const u of [...dispA.units, ...dispB.units]) {
    u.species = SPECIES[u.speciesId];
    byUid[u._uid] = u;
  }

  // Slot order: enemy renders back-row first (top), front-row second (bottom — closer to player).
  //             player renders front-row first (top — closer to enemy), back-row second (bottom).
  const ENEMY_ORDER  = ['B1','B2','B3','F1','F2','F3'];
  const PLAYER_ORDER = ['F1','F2','F3','B1','B2','B3'];

  function statusIcons(u) {
    // Each badge shows the current stack value × type letter. All three statuses decay
    // by 1 per turn (burn deals stack-1 dmg, poison deals stack% of maxHP, stun blocks
    // for stack turns) — so the counter visibly ticks down as turns pass.
    let html = '';
    if (u.burn   > 0) html += `<span class="status-icon burn"   title="Burn ${u.burn}">${u.burn}×B</span>`;
    if (u.poison > 0) html += `<span class="status-icon poison" title="Poison ${u.poison}">${u.poison}×P</span>`;
    if (u.stun   > 0) html += `<span class="status-icon stun"   title="Stun ${u.stun}">${u.stun}×S</span>`;
    return html;
  }

  // Compact battle slot — sprite-centric, HP bar + status icons above, sprite below. No name/level/HP value visible.
  // HP bar is segmented (one tick per HP_PER_SEGMENT HP), so beefier Pokémon visibly show a longer/denser bar.
  const HP_PER_SEGMENT = 10;
  function renderSlot(u) {
    if (!u) return '';
    const hpPct = Math.max(0, Math.floor(u.hp / u.hpMax * 100));
    const hpClass = hpPct < 30 ? 'low' : hpPct < 60 ? 'med' : '';
    const segs = Math.max(1, Math.round(u.hpMax / HP_PER_SEGMENT));
    // Damage counter: total of all damage this unit caused + healing it provided.
    // Shown directly under the HP bar, hidden visually until it goes positive.
    const dmg = u.dmgDealt || 0;
    // Layout order top→bottom: status row (floats at the top of the slot), HP bar
    // (sits right above the sprite, with the dmg-counter just under it), then the sprite.
    // This places the HP bar visually close to the Pokémon — the previous order made
    // the bar the first flex child, so any margin-top tweak just moved the whole stack
    // together, never changing the bar↔sprite gap.
    return `
      <div class="status-row">${statusIcons(u)}</div>
      <div class="hpbar" style="--segs:${segs}">
        <div class="hpbar-fill ${hpClass}" style="width:${hpPct}%"></div>
        <div class="hpbar-ticks"></div>
      </div>
      <div class="dmg-counter" title="Damage + healing dealt this battle">${dmg > 0 ? dmg : ''}</div>
      <img src="${SPRITE_URL(u.species.id)}" alt="${u.name}" loading="lazy">
    `;
  }

  function slotClasses(u) {
    const c = ['battle-slot'];
    if (u.fainted) c.push('fainted');
    return c.join(' ');
  }

  function renderSide(team, order, classMod) {
    return order.map(s => {
      const u = team.units.find(x => x.slot === s);
      if (!u) return `<div class="battle-slot empty"></div>`;
      return `<div class="${slotClasses(u)}" data-uid="${u._uid}">${renderSlot(u)}</div>`;
    }).join('');
  }

  function paintArena() {
    document.querySelector('#side-enemy').innerHTML  = renderSide(dispB, ENEMY_ORDER, 'enemy');
    document.querySelector('#side-player').innerHTML = renderSide(dispA, PLAYER_ORDER, 'player');
    attachAllTooltips();
  }

  function attachAllTooltips() {
    document.querySelectorAll('.battle-slot[data-uid]').forEach(el => {
      const u = byUid[parseInt(el.dataset.uid, 10)];
      if (!u) return;
      const cardHtml = `<div class="slot display">${pokemonCardInnerHTML(u)}</div>`;
      attachTooltip(el, '', cardHtml, { rich: true });
    });
  }

  // Header-right control cluster — exactly one element visible at a time:
  //   • Pre-battle: "Start Battle" button.
  //   • During battle: speed bar (1×/2×/4×); the selected speed stays highlighted.
  //   • Post-battle: "Continue" button.
  // The verdict span sits inline next to the title (left side of the header) and stays
  // empty until the battle ends, at which point it gets "Victory" / "Defeat" / "Draw".
  //
  // The chosen speed is persisted to localStorage under `pm-battle-speed`, so it survives
  // across battles, runs, and page refreshes. The initial speed-active class on each
  // button matches whatever the player picked last time.
  const verdictSuffix = ' <span class="verdict" id="verdict"></span>';
  const savedRaw = parseFloat(localStorage.getItem('pm-battle-speed'));
  const initialSpeed = (savedRaw === 1 || savedRaw === 2 || savedRaw === 4) ? savedRaw : 1;
  const speedActiveCls = (s) => initialSpeed === s ? ' speed-active' : '';
  const rightControls = `
    <div class="battle-controls-bar">
      <button id="btn-start" class="battle-control-btn">${t('battle.startBattle')}</button>
      <div class="battle-speed-bar hidden">
        <button class="speed-btn${speedActiveCls(1)}" data-speed="1">1×</button>
        <button class="speed-btn${speedActiveCls(2)}" data-speed="2">2×</button>
        <button class="speed-btn${speedActiveCls(4)}" data-speed="4">4×</button>
      </div>
      <button id="btn-continue" class="battle-control-btn hidden">${t('battle.continue')}</button>
    </div>
  `;
  setPhase(`${phaseHeader(opponentLabel, '', rightControls, verdictSuffix)}
    <div class="battle-arena">
      <div class="battle-side-wrap">
        <div class="arena-floor arena-enemy"></div>
        <div class="battle-side" id="side-enemy"></div>
      </div>
      <div class="battle-banner">
        <span class="turn-marker" id="turn-marker">Pre-battle</span>
      </div>
      <div class="battle-side-wrap">
        <div class="arena-floor arena-player"></div>
        <div class="battle-side" id="side-player"></div>
      </div>
    </div>
  `);

  paintArena();

  const BASE_MS = 1800;                          // 1x — 2× slower than the previous default
  let speedMult = initialSpeed;                   // persisted across battles/runs/sessions
  let speedMs = BASE_MS / speedMult;
  let started = false;

  function setSpeed(m) {
    speedMult = m;
    speedMs = BASE_MS / speedMult;
    // Persist the player's preferred speed — outlives this battle, the current run, and
    // the browser tab (separate localStorage key from the run save).
    try { localStorage.setItem('pm-battle-speed', String(m)); } catch (e) { /* ignore */ }
    document.querySelectorAll('.speed-btn').forEach(b => {
      const v = parseFloat(b.dataset.speed);
      b.classList.toggle('speed-active', v === speedMult);
    });
  }

  // Clicking the Start Battle button hides itself, swaps the speed bar in, and kicks
  // off the playback. Speed buttons no longer start the battle on their own — they
  // only change the active speed once the battle is already running.
  function start(mult) {
    if (started) return;
    started = true;
    setSpeed(mult);
    document.querySelector('#btn-start').classList.add('hidden');
    document.querySelector('.battle-speed-bar').classList.remove('hidden');
    play();
  }

  document.querySelector('#btn-start').onclick = () => start(speedMult);
  document.querySelectorAll('.speed-btn').forEach(b => {
    b.onclick = () => setSpeed(parseFloat(b.dataset.speed));
  });

  function findUnitDom(uidNum) {
    return document.querySelector(`.battle-slot[data-uid="${uidNum}"]`);
  }

  // Melee tackle — the attacker's sprite leaps to the target's position.
  // Resolves at the impact moment; the return-home animation runs in the background.
  function meleeAttack(srcUid, tgtUid, approachMs) {
    return new Promise(resolve => {
      const src = findUnitDom(srcUid);
      const tgt = findUnitDom(tgtUid);
      if (!src || !tgt) { resolve(); return; }
      const img = src.querySelector('img');
      if (!img) { resolve(); return; }

      const sR = src.getBoundingClientRect();
      const tR = tgt.getBoundingClientRect();
      const dx = (tR.left + tR.width / 2) - (sR.left + sR.width / 2);
      const dy = (tR.top  + tR.height / 2) - (sR.top  + sR.height / 2);

      src.style.zIndex = '20';
      // Approach: snap into the target with an ease-in (accelerating leap).
      img.style.transition = `transform ${approachMs}ms cubic-bezier(0.5, 0, 0.6, 0.6)`;
      img.style.transform = `translate(${dx}px, ${dy}px) scale(1.18)`;

      setTimeout(() => {
        // Impact moment — resolve so the caller can apply damage.
        resolve();
        // Schedule the return-home animation; runs in parallel with damage effects.
        const returnMs = approachMs;
        setTimeout(() => {
          img.style.transition = `transform ${returnMs}ms cubic-bezier(0.4, 0.3, 0.5, 1)`;
          img.style.transform = 'translate(0,0) scale(1)';
          setTimeout(() => {
            src.style.zIndex = '';
            img.style.transition = '';
            img.style.transform = '';
          }, returnMs + 30);
        }, 60);
      }, approachMs);
    });
  }

  // Fire a particle from attacker → target in the attacker's primary type color.
  // Returns a promise that resolves when the particle lands.
  function fireParticle(srcUid, tgtUid, type, durationMs) {
    return new Promise(resolve => {
      const src = findUnitDom(srcUid);
      const tgt = findUnitDom(tgtUid);
      const arena = document.querySelector('.battle-arena');
      if (!src || !tgt || !arena) { resolve(); return; }
      const sR = src.getBoundingClientRect();
      const tR = tgt.getBoundingClientRect();
      const aR = arena.getBoundingClientRect();
      const startX = sR.left + sR.width / 2 - aR.left;
      const startY = sR.top  + sR.height / 2 - aR.top;
      const endX   = tR.left + tR.width / 2 - aR.left;
      const endY   = tR.top  + tR.height / 2 - aR.top;

      const p = document.createElement('div');
      p.className = 'particle type-' + (type || 'normal');
      p.style.left = startX + 'px';
      p.style.top  = startY + 'px';
      arena.appendChild(p);

      // Two frames: one to mount, one to apply transform so the transition runs.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const easing = 'cubic-bezier(0.45, 0.05, 0.55, 1)';
          p.style.transition = `transform ${durationMs}ms ${easing}, opacity 120ms ease-out`;
          p.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(1.2)`;
        });
      });

      setTimeout(() => {
        // Impact burst then remove
        const burst = document.createElement('div');
        burst.className = 'impact-burst';
        tgt.appendChild(burst);
        setTimeout(() => burst.remove(), 400);
        p.style.opacity = '0';
        setTimeout(() => p.remove(), 150);
        resolve();
      }, durationMs);
    });
  }

  function refreshSlot(uidNum) {
    const u = byUid[uidNum]; if (!u) return;
    const el = findUnitDom(uidNum); if (!el) return;
    el.innerHTML = renderSlot(u);
    if (u.fainted) el.classList.add('fainted');
  }
  // Surgical update for just the .dmg-counter cell. Used after a 'hit' or 'heal' to
  // credit the source's running damage total WITHOUT rebuilding the slot's <img> —
  // which would otherwise replace the in-flight melee attack sprite and break its
  // return-home transition (look like a teleport).
  function refreshDmgCounter(uidNum) {
    const u = byUid[uidNum]; if (!u) return;
    const el = findUnitDom(uidNum); if (!el) return;
    const counter = el.querySelector('.dmg-counter');
    if (!counter) return;
    const dmg = u.dmgDealt || 0;
    counter.textContent = dmg > 0 ? String(dmg) : '';
  }
  function popup(uidNum, text, klass = '') {
    const slot = findUnitDom(uidNum); if (!slot) return;
    // Attach to <body> with position:fixed so the popup floats above every other element
    // (team panel, top bar, tooltips, etc.) and isn't constrained by any container's z-index.
    const sR = slot.getBoundingClientRect();
    const p = document.createElement('div');
    p.className = 'battle-popup ' + klass;
    p.textContent = text;
    p.style.left = (sR.left + sR.width / 2) + 'px';
    p.style.top  = (sR.top  + sR.height * 0.30) + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1800);
  }
  function shoutAbility(uidNum, text) {
    const el = findUnitDom(uidNum); if (!el) return;
    const p = document.createElement('div');
    p.className = 'ability-shout';
    p.textContent = text;
    el.appendChild(p);
    setTimeout(() => p.remove(), 1300);
  }
  function flash(uidNum, cls, ms = 400) {
    const el = findUnitDom(uidNum); if (!el) return;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  const setBanner = (text) => { document.querySelector('#turn-marker').textContent = text; };

  async function play() {
    for (const e of result.log) {
      const step = speedMs;   // capture current speed (may toggle mid-battle via FF)
      switch (e.t) {
        case 'turnStart':
          setBanner(`Turn ${e.turn}`);
          await wait(step * 0.4);
          break;
        case 'disrupt':
          await wait(step * 0.6);
          break;
        case 'ability':
          shoutAbility(e.who, e.name);
          await wait(speedMs * 0.35);
          break;
        case 'atk': {
          // Animation only — particle/melee + attacker pulse. Damage is applied by the 'hit' event that follows.
          const atk = byUid[e.a], tgt = byUid[e.tgt];
          if (!atk || !tgt) break;
          if (isPhysical(atk.type1)) {
            await meleeAttack(e.a, e.tgt, Math.max(180, step * 0.26));
          } else {
            flash(e.a, 'is-attacking', 300);
            await wait(step * 0.08);
            await fireParticle(e.a, e.tgt, atk.type1, Math.max(150, step * 0.22));
          }
          break;
        }
        case 'hit': {
          // Damage popup — fires for every source: direct attacks, splash (Trample/Discharge),
          // Sniper extra hit, Solar Beam, Rocky Helmet reflect, Aftermath, Yawn/Explosion KOs.
          const u = byUid[e.who]; if (!u) break;
          u.hp = Math.max(0, u.hp - e.dmg);
          // Credit the attacker on the in-battle damage counter, then re-render their slot
          // so the new total shows immediately (not just on next event).
          const src = e.from != null ? byUid[e.from] : null;
          // Surgical badge refresh on the attacker — refreshSlot would replace their <img>
          // and snap a mid-flight melee return animation back to its original position.
          if (src && e.dmg > 0) { src.dmgDealt = (src.dmgDealt || 0) + e.dmg; refreshDmgCounter(e.from); }
          flash(e.who, 'is-hit', 400);
          // Crit or super-effective hits also play a brief zoom-bump on the target sprite
          // — extra visual "oomph" so big damage frames stand out from chip damage.
          if (e.crit || e.tmult > 1) flash(e.who, 'is-impact', 360);
          // Combine crit/super/resist classes — type effectiveness picks one of super/resist
          // (tmult > 1 / tmult < 1); crit stacks on top of either. tmult == 1 → no extra class.
          const eff = e.tmult > 1 ? 'super' : e.tmult < 1 ? 'resist' : '';
          const cls = [e.crit ? 'crit' : '', eff].filter(Boolean).join(' ');
          popup(e.who, '-' + e.dmg, cls);
          refreshSlot(e.who);
          await wait(step * 0.30);
          break;
        }
        case 'burn': {
          const u = byUid[e.who]; if (!u) break;
          // Sync the animation's local burn counter with the engine's post-decay value
          // so the on-screen badge ticks down each turn (even when dmg is 0).
          if (e.remaining != null) u.burn = e.remaining;
          if (e.dmg > 0) {
            u.hp = Math.max(0, u.hp - e.dmg);
            flash(e.who, 'is-burning', 500);
            popup(e.who, '-' + e.dmg);
          }
          refreshSlot(e.who);
          await wait(step * (e.dmg > 0 ? 0.4 : 0.15));
          break;
        }
        case 'poison': {
          const u = byUid[e.who]; if (!u) break;
          if (e.remaining != null) u.poison = e.remaining;
          if (e.dmg > 0) {
            u.hp = Math.max(0, u.hp - e.dmg);
            flash(e.who, 'is-poisoned', 500);
            popup(e.who, '-' + e.dmg);
          }
          refreshSlot(e.who);
          await wait(step * (e.dmg > 0 ? 0.4 : 0.15));
          break;
        }
        // Status apply events tag the slot with .just-applied for one frame so the
        // newest status icon plays a pop-in animation. refreshSlot must run first
        // (it rewrites the slot HTML); we then add the class and let it auto-clear.
        case 'applyBurn':   byUid[e.who] && (byUid[e.who].burn  += e.amount); refreshSlot(e.who); flash(e.who, 'just-applied', 320); await wait(step * 0.18); break;
        case 'applyPoison': byUid[e.who] && (byUid[e.who].poison += e.amount); refreshSlot(e.who); flash(e.who, 'just-applied', 320); await wait(step * 0.18); break;
        case 'applyStun': {
          const u = byUid[e.who]; if (u) { if (e.dur > u.stun) u.stun = e.dur; refreshSlot(e.who); flash(e.who, 'just-applied', 320); }
          await wait(step * 0.25);
          break;
        }
        // Per-turn stun decay — the engine decrements u.stun in onTurnEnd and emits this event
        // so the animation can tick the on-screen "Nx S" badge down to match.
        case 'stunTick': {
          const u = byUid[e.who]; if (!u) break;
          u.stun = e.remaining;
          refreshSlot(e.who);
          await wait(step * 0.12);
          break;
        }
        case 'faint': {
          const u = byUid[e.who]; if (!u) break;
          u.fainted = true; u.hp = 0;
          const el = findUnitDom(e.who);
          // Apply the animation class directly (not via `flash`, which would auto-remove it on a
          // setTimeout that races with this `await` and snaps the sprite back to its original
          // position for one paint frame).
          if (el) el.classList.add('is-fainting');
          await wait(Math.max(1100, step * 0.7));      // let the tumble play out
          // Hide BEFORE removing the animation class — the slot is invisible by the time the
          // `forwards` fill effect releases, so no snap-back is ever painted. We also skip
          // refreshSlot here, since replacing innerHTML would create a fresh <img> and restart
          // the animation from frame 0 (briefly showing the original-position pose).
          if (el) {
            el.classList.add('fainted');               // visibility: hidden — sprite is gone
            el.classList.remove('is-fainting');
          }
          break;
        }
        case 'revive': {
          const u = byUid[e.who]; if (!u) break;
          u.fainted = false; u.hp = e.hp || Math.floor(u.hpMax * 0.4);
          // Self-revive (Shed Skin) — credit the revived amount toward this unit's counter.
          u.dmgDealt = (u.dmgDealt || 0) + u.hp;
          flash(e.who, 'is-reviving', 700);
          popup(e.who, '+' + u.hp, 'heal');
          refreshSlot(e.who);
          const el = findUnitDom(e.who); if (el) el.classList.remove('fainted');
          await wait(step * 0.55);
          break;
        }
        case 'rest': {
          const u = byUid[e.who]; if (!u) break;
          const healed = u.hpMax - u.hp;
          u.hp = u.hpMax; u.stun = Math.max(u.stun, 3);
          // Rest is a self-heal — credit the amount restored toward the unit's counter.
          if (healed > 0) u.dmgDealt = (u.dmgDealt || 0) + healed;
          flash(e.who, 'is-healed', 700);
          if (healed > 0) popup(e.who, '+' + healed, 'heal');
          refreshSlot(e.who);
          await wait(step * 0.5);
          break;
        }
        case 'heal': {
          const u = byUid[e.who]; if (!u) break;
          u.hp = Math.min(u.hpMax, u.hp + e.amount);
          if (e.bumpMax) u.hpMax += e.amount;
          // Credit whichever unit caused the heal (e.from is set by heal() in the engine).
          const src = e.from != null ? byUid[e.from] : null;
          if (src && e.amount > 0) { src.dmgDealt = (src.dmgDealt || 0) + e.amount; refreshDmgCounter(e.from); }
          flash(e.who, 'is-healed', 600);
          popup(e.who, '+' + e.amount, 'heal');
          refreshSlot(e.who);
          await wait(step * 0.35);
          break;
        }
        case 'dodge': {
          popup(e.who, 'Miss', 'miss');
          await wait(step * 0.3);
          break;
        }
        case 'swap': {
          const a = byUid[e.a], b = e.b ? byUid[e.b] : null;
          if (!a) break;
          a.slot = e.aTo;
          if (b) b.slot = e.bTo;
          paintArena();
          await wait(step * 0.5);
          break;
        }
        case 'explode':
          // The 'explode' marker is informational only; the damage popups for each KO'd enemy
          // come through the 'hit' events that dealDamage emits.
          await wait(step * 0.3);
          break;
        case 'imposter': {
          // Ditto copied an ally — swap its animation snapshot to the copied species so
          // refreshSlot picks the new sprite, and tag the slot with .is-imposter for the
          // persistent purple tint defined in styles.css.
          const u = byUid[e.who]; if (!u) break;
          u.speciesId = e.copiedSpeciesId;
          u.species = SPECIES[e.copiedSpeciesId];
          if (e.copiedName) u.name = e.copiedName;
          refreshSlot(e.who);
          const slot = findUnitDom(e.who);
          if (slot) slot.classList.add('is-imposter');
          await wait(step * 0.3);
          break;
        }
      }
    }
    const verdictText  = result.winner === 'A' ? t('battle.victory') : result.winner === 'B' ? t('battle.defeat') : t('battle.draw');
    const verdictClass = result.winner === 'A' ? 'win'     : result.winner === 'B' ? 'lose'   : 'draw';
    const verdictEl = document.querySelector('#verdict');
    verdictEl.textContent = verdictText;
    verdictEl.classList.add(verdictClass);
    setBanner('');                              // clear the turn-counter slot at end of battle
    // Celebration burst — gym leader and PvP wins only. Adventure trainer wins don't
    // qualify (they're routine), and losses/draws obviously don't. The label-prefix check
    // is the cheapest way to distinguish without threading a flag through runBattle.
    if (result.winner === 'A' && !opponentLabel.startsWith('Trainer:')) {
      spawnConfettiBurst();
    }
    // Swap the speed bar out for the Continue button in the header-right slot.
    document.querySelector('.battle-speed-bar').classList.add('hidden');
    const cont = document.querySelector('#btn-continue');
    cont.classList.remove('hidden');
    cont.onclick = () => callback(result);
  }
}

// ─── Phase: Town ──────────────────────────────────────────────────────────
function startTown() {
  setTopbarStep(null);
  state.phase = 'town';
  // Persist the offered shop items so refreshing town doesn't reshuffle the catalog
  // and let the player rotate offers by reloading.
  if (!state.townOffer) {
    const itemPool = Object.values(ITEMS);
    state.townOffer = itemPool.slice().sort(() => rng.float() - 0.5).slice(0, 3).map(x => x.id);
  }
  const offered = state.townOffer.map(id => ITEMS[id]).filter(Boolean);
  save();
  const renderTown = () => {
    const itemCards = offered.map(it => {
      const iconUrl = itemIcon(it.id);
      // Horizontal "shop-item" layout: tiny icon at the left, [name + price] on the same line
      // at the right, and the description below — keeps each row lean vertically.
      return `<div class="card shop-item${state.money < it.cost ? ' disabled' : ''}" data-item="${it.id}">
        ${iconUrl ? `<img src="${iconUrl}" alt="${it.name}" class="card-item-icon" loading="lazy">` : ''}
        <div class="shop-item-info">
          <div class="shop-item-head">
            <span class="ctitle">${it.name}</span>
            <span class="cost">$${it.cost}</span>
          </div>
          <div class="csub">${itemTooltip(it.id)}</div>
        </div>
      </div>`;
    }).join('');
    // Pricing helper — used by both the dragover preview and the drop handler.
    //   • Pokémon         → S.sellValue(p) (existing formula)
    //   • Full-size berry → RUN.berrySellMoney ($300)
    //   • Small berry     → flat $100
    //   • Regular item    → half its shop cost (rounded down)
    const sellPriceForItem = (it) => {
      if (!it) return 0;
      const b = BERRIES[it.id];
      if (b) return b.small ? 100 : RUN.berrySellMoney;
      const itemDef = ITEMS[it.id];
      return itemDef ? Math.floor((itemDef.cost || 0) / 2) : 0;
    };

    // Reroll button — sits in the right slot of the phase header, opposite the title.
    // Price escalates by $100 per reroll across the entire run, so spamming refreshes
    // gets expensive fast. state.townRerolls tracks the count and never resets until
    // the run ends. Button greys out when the player can't afford it.
    const rerollCount = state.townRerolls | 0;
    const rerollCost = 100 + rerollCount * 100;
    const canAfford = state.money >= rerollCost;
    const rerollBtn = `<button id="btn-reroll-shop" class="town-reroll-btn" ${canAfford ? '' : 'disabled'}>${t('town.rerollBtn')}&nbsp;&nbsp;<span class="reroll-cost">$${rerollCost}</span></button>`;

    setPhase(`${phaseHeader(t('town.title', ZONES[state.zone - 1].name), '', rerollBtn)}
      <div class="town-choices">${itemCards}</div>

      <div class="sell-zone" id="sell-drop">${t('town.sellLabel')}</div>

      <div style="text-align:center;margin-top:24px;">
        <button class="primary" id="btn-next-zone">${t('town.continue')}</button>
      </div>`);

    // Reroll handler — charges the escalating fee, regenerates state.townOffer with a
    // fresh random 3-pick from the full item pool, increments the run-wide counter,
    // and re-renders so the new prices show. RNG keeps using the deterministic seed
    // so a refresh mid-reroll re-resolves to the same shuffle.
    const rerollEl = document.querySelector('#btn-reroll-shop');
    if (rerollEl) {
      rerollEl.onclick = () => {
        if (state.money < rerollCost) return;
        state.money -= rerollCost;
        state.townRerolls = rerollCount + 1;
        const itemPool = Object.values(ITEMS);
        state.townOffer = itemPool.slice().sort(() => rng.float() - 0.5).slice(0, 3).map(x => x.id);
        save();
        repaint();
        startTown();      // full re-entry so `offered` and the rendered cards refresh
      };
    }

    // Sell-zone drop handler — accepts BOTH Pokémon drags (from the team display) and
    // item drags (from the bottom-bar item slots). The dragover preview swaps the
    // "Drag here…" label for "+$N" so the player sees what the sell will earn before
    // committing. window.__pmDrag is mirrored by both the slot and item dragstart
    // handlers because dataTransfer.getData is locked outside the actual drop event.
    const drop = document.querySelector('#sell-drop');
    const DEFAULT_LABEL = t('town.sellLabel');
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      // Idempotent guard — dragover fires every few px, only refresh content on the
      // first event of a given hover so we don't churn DOM on every mouse tick.
      if (drop.classList.contains('drag-over')) return;
      drop.classList.add('drag-over');
      const drag = window.__pmDrag;
      if (drag?.type === 'pokemon') {
        const p = state.team[drag.slot];
        if (p) {
          // Block-the-last-pokemon rule (and the daycare lock) surface in the preview.
          if (p.inDaycare) {
            drop.innerHTML = `<span class="sell-preview blocked">${t('town.sellBlockedDaycare')}</span>`;
          } else if (S.teamCount(state) <= 1) {
            drop.innerHTML = `<span class="sell-preview blocked">${t('town.sellBlockedLast')}</span>`;
          } else {
            drop.innerHTML = `<span class="sell-preview">${t('town.sellAmount', S.sellValue(p))}</span>`;
          }
        }
      } else if (drag?.type === 'item') {
        const it = state.items[drag.slotIdx];
        if (it) {
          drop.innerHTML = `<span class="sell-preview">${t('town.sellAmount', sellPriceForItem(it))}</span>`;
        }
      }
    });
    drop.addEventListener('dragleave', () => {
      drop.classList.remove('drag-over');
      drop.textContent = DEFAULT_LABEL;
    });
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('drag-over');
      drop.textContent = DEFAULT_LABEL;        // reset content after a successful or no-op drop
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.type === 'pokemon') {
          const p = state.team[data.slot];
          if (!p || p.inDaycare) return;
          if (S.teamCount(state) <= 1) return;   // keep at least one Pokémon
          state.money += S.sellValue(p);
          delete state.team[data.slot];
          repaint(); renderTown();
        } else if (data.type === 'item') {
          const it = state.items[data.slotIdx];
          if (!it) return;
          state.money += sellPriceForItem(it);
          S.removeItem(state, data.slotIdx);
          save(); repaint(); renderTown();
        }
      } catch {}
    });
    document.querySelectorAll('.card[data-item]').forEach(el => {
      el.onclick = () => {
        if (el.classList.contains('disabled')) return;
        const id = el.dataset.item;
        const it = ITEMS[id]; if (state.money < it.cost) return;
        if (!S.hasItemSlot(state)) { alert(t('inventory.slotsFull')); return; }
        state.money -= it.cost; S.addItem(state, id);
        // Remove from offered (no duplicates this town)
        const idx = offered.findIndex(x => x.id === id);
        if (idx >= 0) offered.splice(idx, 1);
        state.townOffer = offered.map(x => x.id);
        save(); repaint(); renderTown();
      };
    });
    // (Previously: per-berry click cards. Selling is now handled exclusively by dragging
    // either a Pokémon or an item onto the unified #sell-drop zone above.)
    document.querySelector('#btn-next-zone').onclick = () => {
      // Capture a snapshot of the team that just cleared this zone — provides the
      // PvP pool with a roster at this zone's level tier. See snapshots.js for the
      // capture rules (mode gating, queue cap, server sync).
      saveSnapshot(state, 'zoneClear');
      state.zone++;
      state.townOffer = null;                 // reshuffle next town
      state.seenTrainers = [];                // fresh trainer pool for the new zone
      if (state.zone > 7) { save(); return endRun(state.badges >= RUN.badgesToWin ? 'won' : 'lost'); }
      startAdventure();
    };
  };
  renderTown();
}

// ─── End run ──────────────────────────────────────────────────────────────
// ELO change by badges earned — rewards full clears heavily, penalizes early flameouts.
// Singleplayer always returns 0.
//   0 badges: −150   1 badge:  −100   2 badges: −50
//   3 badges:   0   (neutral run — keep what you had)
//   4 badges: +75   5 badges (won): +250
const ELO_BY_BADGES = [-150, -100, -50, 0, 75, 250];
function eloDeltaForRun(state) {
  if (state.mode !== 'ranked') return 0;
  const badges = Math.max(0, Math.min(5, state.badges | 0));
  return ELO_BY_BADGES[badges];
}

function endRun(result) {
  setTopbarStep(null);
  state.result = result; state.runOver = true;
  state.phase = 'ended';
  S.clearRun();
  updateOptionsButton();
  // Apply ELO delta now so the result screen can animate from oldElo → newElo.
  const oldElo = state.elo | 0;
  const eloDelta = eloDeltaForRun(state);
  if (eloDelta !== 0) {
    state.elo = Math.max(0, oldElo + eloDelta);
    localStorage.setItem('pm-elo', state.elo);
  }
  const newElo = state.elo | 0;

  // Pokédex medals — awarded only on a COMPLETE ranked run win.
  if (result === 'won' && state.mode === 'ranked') {
    for (const p of S.teamArray(state)) {
      if (p && p.speciesId) markRankedWin(p.speciesId);
    }
  }

  saveSnapshot(state, 'runEnd');
  import('./api.js').then(({ api }) => api.endRun?.(state, result).catch(()=>{}));

  // Shared ELO progress bar — used by both victory and defeat. Each "sub-rank" spans
  // 200 ELO, so the bar shows progress within that 200-point band; tier name + roman
  // numeral mirror the topbar's ranking display. Old position renders first, then the
  // bar slides to the new position on the next paint frame for a smooth fill/empty.
  const renderEloBlock = (oldEloVal, newEloVal) => {
    if (state.mode !== 'ranked') {
      return `<div class="result-elo-sub">${t('result.singlePlayerNoElo')}</div>`;
    }
    const oldPct = Math.max(0, Math.min(100, ((oldEloVal % 200) / 200) * 100));
    const newPct = Math.max(0, Math.min(100, ((newEloVal % 200) / 200) * 100));
    const delta = newEloVal - oldEloVal;
    const deltaCls = delta > 0 ? 'gain' : delta < 0 ? 'loss' : 'neutral';
    const deltaTxt = delta > 0 ? `+${delta}` : (delta < 0 ? `${delta}` : '±0');
    return `
      <div class="result-elo-block">
        <div class="result-elo-row">
          <div class="result-elo-numbers"><span class="result-elo-value">${oldEloVal}</span></div>
          <div class="result-elo-delta ${deltaCls}">${deltaTxt} ${t('menu.elo')}</div>
        </div>
        <div class="result-elo-bar">
          <div class="result-elo-fill ${deltaCls}" style="width:${oldPct}%" data-target="${newPct}"></div>
        </div>
        <div class="result-elo-foot"><span>${t('result.currentRankTier')}</span><span class="result-elo-next">${t('result.subRank', oldEloVal % 200)}</span></div>
      </div>
    `;
  };

  if (result === 'won') {
    setPhase(`${phaseHeader(t('result.runComplete'), t('result.runCompleteSub', state.playerName))}
      <div class="result-screen result-victory">
        <div class="result-title">${t('result.victory')}</div>
        ${renderEloBlock(oldElo, newElo)}
        <button class="primary" style="margin-top:24px;" id="btn-restart">${t('result.backToTitle')}</button>
      </div>`);
  } else {
    setPhase(`
      <div class="defeat-screen">
        <div class="defeat-title">${t('result.defeat')}</div>
        <div class="defeat-subtitle">${escapeHtml(t('result.defeatSub', state.playerName))}</div>
        <div class="defeat-stats">
          <div class="defeat-stat">
            <div class="defeat-stat-value">${state.badges}</div>
            <div class="defeat-stat-label">${t('result.badgesEarned')}</div>
          </div>
          <div class="defeat-stat">
            <div class="defeat-stat-value">${state.zone}</div>
            <div class="defeat-stat-label">${t('result.zoneReached')}</div>
          </div>
        </div>
        ${renderEloBlock(oldElo, newElo)}
        <button class="primary defeat-btn" id="btn-restart">${t('result.backToTitle')}</button>
      </div>
    `);
  }

  // Trigger the bar's fill animation on the next frame so the CSS transition fires
  // (the initial render set width to the OLD percentage; we now slide to the new).
  // Also tween the displayed ELO number from old to new.
  requestAnimationFrame(() => {
    const fill = document.querySelector('.result-elo-fill');
    if (fill) fill.style.width = fill.dataset.target + '%';
    const valEl = document.querySelector('.result-elo-value');
    if (valEl && state.mode === 'ranked' && oldElo !== newElo) {
      const t0 = performance.now();
      const dur = 700;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        valEl.textContent = Math.round(oldElo + (newElo - oldElo) * eased);
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  });

  // Continuous celebration rain on a successful run.
  const stopConfetti = (result === 'won') ? startConfettiRain() : null;
  document.querySelector('#btn-restart').onclick = () => {
    stopConfetti?.();
    showTitle();
  };
}

// Small local helper — minimal HTML escape for the player name in the defeat screen.
function escapeHtml(s) { return (s + '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
