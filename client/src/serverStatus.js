// Server status pill — polls /api/stats and updates the top-left widget.
//
// Three visual states: online (green dot + "N players"), offline (red dot +
// localized "Offline"), unknown (grey, only briefly during first poll).
// Falls offline on any fetch failure or non-OK status; falls back online on
// the next successful poll. The widget always lives in the DOM (no .hidden
// toggle) so players always know whether their actions are syncing.

import { t, getLocale } from './i18n.js';

const POLL_INTERVAL_MS = 30 * 1000;
// First poll fires fast so the "…" placeholder doesn't linger; subsequent
// polls use POLL_INTERVAL_MS. If a poll fails we keep the cadence — no need
// to back off aggressively, 30s is already gentle.
const FIRST_POLL_DELAY_MS = 200;

// Same server base discovery as api.js — query override first, then localhost
// during dev, then same-origin /api in production.
function statsUrl() {
  const fromQuery = location.search.match(/server=([^&]+)/)?.[1];
  if (fromQuery) return decodeURIComponent(fromQuery) + '/stats';
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'http://localhost:3000/stats';
  return '/api/stats';
}

let pollTimer = null;
let lastOnline = null;       // remember the count so language switches can re-render without a fresh poll

function setState(state, online) {
  const el = document.querySelector('#server-status');
  if (!el) return;
  el.classList.remove('status-online', 'status-offline', 'status-unknown');
  el.classList.add(`status-${state}`);
  const text = el.querySelector('.status-text');
  if (!text) return;
  if (state === 'online') {
    text.textContent = t('status.online', online);
    el.title = t('status.titleOnline', online);
  } else if (state === 'offline') {
    text.textContent = t('status.offline');
    el.title = t('status.titleOffline');
  } else {
    text.textContent = '…';
    el.title = 'Server status';
  }
}

async function pollOnce() {
  try {
    const res = await fetch(statsUrl(), { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error('stats ' + res.status);
    const data = await res.json();
    const online = data.online | 0;
    lastOnline = online;
    setState('online', online);
  } catch {
    // Network down / server unreachable / 5xx — show offline. The game still
    // works in local-only mode, so this is informational, not blocking.
    lastOnline = null;
    setState('offline');
  }
}

// Public — start polling. Safe to call repeatedly; later calls reuse the timer.
export function startServerStatus() {
  if (pollTimer) return;
  setState('unknown');
  setTimeout(pollOnce, FIRST_POLL_DELAY_MS);
  pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
}

// Public — when the locale changes, refresh the displayed text without polling.
// Caller is i18n's setLocale flow inside phases.js.
export function refreshServerStatusLabels() {
  const el = document.querySelector('#server-status');
  if (!el) return;
  if (el.classList.contains('status-online') && lastOnline != null) {
    setState('online', lastOnline);
  } else if (el.classList.contains('status-offline')) {
    setState('offline');
  } else {
    setState('unknown');
  }
}
