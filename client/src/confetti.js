// DOM-based confetti, no external libraries.
//
// Two modes:
//   • spawnConfettiBurst()   — one-shot celebration on gym/PvP wins, self-cleans
//   • startConfettiRain()    — continuous rain for run-completion screen,
//                              returns a stop() function so the caller can end it on navigate
//
// Pieces are small absolutely-positioned divs animated via a single CSS keyframe
// (`confetti-fall` in styles.css). Each piece gets randomized color, start column,
// fall duration, and start/end rotation passed in as CSS custom properties.

const COLORS = ['#ff4d6d','#ffd166','#06d6a0','#118ab2','#9b5de5','#f15bb5','#fee440','#00bbf9'];

function makePiece() {
  const piece = document.createElement('div');
  piece.className = 'confetti-piece';
  if (Math.random() < 0.4) piece.classList.add('round');     // mix of rectangles + circles
  const color   = COLORS[Math.floor(Math.random() * COLORS.length)];
  const left    = Math.random() * 100;                       // vw
  const fall    = 2500 + Math.random() * 2500;               // ms
  const rotFrom = Math.random() * 360;
  const rotTo   = rotFrom + (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 720);
  piece.style.left = `${left}vw`;
  piece.style.background = color;
  piece.style.setProperty('--rotate-from', `${rotFrom}deg`);
  piece.style.setProperty('--rotate-to',   `${rotTo}deg`);
  piece.style.animationDuration = `${fall}ms`;
  return { piece, fall };
}

function ensureLayer() {
  let layer = document.querySelector('#confetti-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'confetti-layer';
    document.body.appendChild(layer);
  }
  return layer;
}

export function spawnConfettiBurst(count = 90) {
  const layer = ensureLayer();
  for (let i = 0; i < count; i++) {
    // Tiny stagger so the burst feels like a spray instead of a single horizontal line drop.
    const delay = Math.random() * 250;
    setTimeout(() => {
      const { piece, fall } = makePiece();
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), fall + 100);
    }, delay);
  }
}

export function startConfettiRain() {
  const layer = ensureLayer();
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    // 3-5 pieces per tick, roughly 5 ticks/sec = sustained but not laggy.
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const { piece, fall } = makePiece();
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), fall + 100);
    }
    setTimeout(tick, 200);
  };
  tick();
  // Stop returns a cleanup that also clears any pieces still in flight, so navigating
  // away from the celebration screen doesn't leave debris falling over the title.
  return () => {
    stopped = true;
    const layer = document.querySelector('#confetti-layer');
    if (layer) layer.innerHTML = '';
  };
}
