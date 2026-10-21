// Contour field: topographic isolines of a slowly drifting scalar field, traced with
// marching squares. The field rises into a hill under the resting pointer (and under taps).
import { P, onFrame, still, ease } from './main.js';

const canvas = document.querySelector('.field');
const ctx = canvas.getContext('2d');
const LEVELS = 8;
const lost = document.body.classList.contains('lost-page'); // 404: a flatter map with one bright ring
let W = 0, H = 0, dpr = 1, cell = 28, cols = 0, rows = 0, vals = new Float32Array(0);
let rgb = '255,42,42', alpha = 0.16, hill = 0, lastDraw = -1e9, lastScroll = 0, lastMove = 0;
// The field keeps its own clock so pausing while idle never makes the map jump on resume
let clock = 0, bloom = still ? 1 : 0;
const t0 = performance.now();
const taps = [];

function readColors() {
  const cs = getComputedStyle(document.documentElement);
  rgb = cs.getPropertyValue('--field').trim().split(/\s+/).join(',');
  alpha = parseFloat(cs.getPropertyValue('--field-a')) || 0.16;
}
function resize() {
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  cell = W < 700 ? 36 : 28;
  cols = Math.ceil(W / cell) + 1; rows = Math.ceil(H / cell) + 1;
  vals = new Float32Array(cols * rows);
}

const TAP_MS = 1400;
// Height of the map at one screen point: drifting terrain + pointer hill + sounding ripples
function fieldAt(px, py, t, now) {
  const x = px / 200, y = (py + scrollY * 0.12) / 200;
  let f = (lost ? 0.45 : 1) * bloom * (Math.sin(x * 0.9 + t * 0.07) * Math.cos(y * 1.1 - t * 0.05) + 0.55 * Math.sin((x + y) * 1.7 + t * 0.03) + 0.35 * Math.cos(x * 2.3 - y * 1.3));
  if (hill > 0.01) { const dx = px - P.x, dy = py - P.y; f += hill * Math.exp(-(dx * dx + dy * dy) / 16200); }
  for (const tp of taps) {
    // A sounding is a ring that rolls outward and fades
    const age = now - tp.t, d = Math.hypot(px - tp.x, py - tp.y) - age * 0.4;
    f += 1.1 * (1 - age / TAP_MS) * Math.exp(-(d * d) / 4050);
  }
  if (lost) { const dx = px - W / 2, dy = py - H / 2; f += 1.2 * Math.exp(-(dx * dx + dy * dy) / (2 * 140 * 140)); }
  return f;
}
function sample(t, now) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) vals[j * cols + i] = fieldAt(i * cell, j * cell, t, now);
}

// Marching squares for one level: corner bits tl=8 tr=4 br=2 bl=1, edges interpolated linearly
function trace(l) {
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = vals[j * cols + i], b = vals[j * cols + i + 1], c = vals[(j + 1) * cols + i + 1], d = vals[(j + 1) * cols + i];
    const idx = (a > l ? 8 : 0) | (b > l ? 4 : 0) | (c > l ? 2 : 0) | (d > l ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    // Edge crossings (only the ones a case uses are meaningful): top, right, bottom, left
    const x = i * cell, y = j * cell;
    const tx = x + cell * (l - a) / (b - a), ry = y + cell * (l - b) / (c - b);
    const bx = x + cell * (l - d) / (c - d), ly = y + cell * (l - a) / (d - a);
    const xr = x + cell, yb = y + cell;
    switch (idx) {
      case 1: case 14: ctx.moveTo(x, ly); ctx.lineTo(bx, yb); break;
      case 2: case 13: ctx.moveTo(bx, yb); ctx.lineTo(xr, ry); break;
      case 3: case 12: ctx.moveTo(x, ly); ctx.lineTo(xr, ry); break;
      case 4: case 11: ctx.moveTo(tx, y); ctx.lineTo(xr, ry); break;
      case 5: ctx.moveTo(x, ly); ctx.lineTo(tx, y); ctx.moveTo(bx, yb); ctx.lineTo(xr, ry); break;
      case 6: case 9: ctx.moveTo(tx, y); ctx.lineTo(bx, yb); break;
      case 7: case 8: ctx.moveTo(x, ly); ctx.lineTo(tx, y); break;
      case 10: ctx.moveTo(tx, y); ctx.lineTo(xr, ry); ctx.moveTo(x, ly); ctx.lineTo(bx, yb); break;
    }
  }
}

function draw(now) {
  clock += Math.min(now - lastDraw, 200) / 1000;
  if (!still) { const p = Math.min(1, (now - t0) / 1400); bloom = 1 - (1 - p) ** 3; }
  sample(clock, now);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // Survey lens: lines brighten around the pointer while the hill is up
  const lensOn = hill > 0.05;
  for (let k = 0; k < LEVELS; k++) {
    const l = -1.6 + (k * 3.2) / (LEVELS - 1), index = k % 4 === 3, a = index ? alpha * 1.9 : alpha;
    ctx.lineWidth = index ? 1.25 : 1;
    if (lensOn) {
      const g = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 220);
      g.addColorStop(0, `rgba(${rgb},${Math.min(1, a * (1 + 2.2 * hill / 0.9)).toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgb},${a.toFixed(3)})`);
      ctx.strokeStyle = g;
    } else ctx.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`;
    ctx.beginPath();
    trace(l);
    ctx.stroke();
  }
  if (lost) { ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${rgb},${Math.min(1, alpha * 4)})`; ctx.beginPath(); trace(1.05); ctx.stroke(); }
  canvas.classList.add('on');
  lastDraw = now;
}

readColors();
resize();
const redraw = () => draw(performance.now());
addEventListener('sidechange', () => { readColors(); redraw(); });
let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); redraw(); }, 150); });
redraw();

if (!still) {
  addEventListener('scroll', () => { lastScroll = performance.now(); }, { passive: true });
  // Soundings: tap or click empty map to send a ripple through the contours
  addEventListener('pointerdown', e => {
    if (e.button || e.target.closest('a, button, input, textarea, select, summary, label, [role=tab], dialog, .spec, .greeks, .drill')) return;
    taps.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (taps.length > 4) taps.shift();
    readout(e.clientX, e.clientY, 'SOUNDING');
  }, { passive: true });
  onFrame((now, dt) => {
    const moving = P.active && P.type !== 'touch' && now - P.last < 1500;
    if (moving) lastMove = now;
    hill += ((moving ? 0.9 : 0) - hill) * ease(0.06, dt);
    while (taps.length && now - taps[0].t > TAP_MS) taps.shift();
    const busy = moving || hill > 0.02 || taps.length || now - lastScroll < 600 || bloom < 1;
    // Drift slowly at 5 fps for a few seconds after activity, then stop drawing entirely
    const idle = now - Math.max(lastMove, lastScroll) > 4000;
    if (busy ? now - lastDraw >= 50 : !idle && now - lastDraw >= 200) draw(now);
  });
}

// Survey readout in the hero datapad: the map's elevation and grid cell under the pointer
const elev = document.querySelector('.elev');
const hero = document.querySelector('.hero');
let lastRead = 0;
function readout(x, y, label = 'ELEV') {
  if (!elev) return;
  const f = fieldAt(x, y, clock, performance.now());
  const pad = n => String(n).padStart(2, '0');
  elev.textContent = `${label} ${f >= 0 ? '+' : '−'}${Math.abs(f).toFixed(2)} · GRID ${pad(Math.floor(x / cell))}/${pad(Math.floor(y / cell))}`;
}
if (elev && hero) {
  hero.addEventListener('pointermove', e => {
    const now = performance.now();
    if (e.pointerType !== 'mouse' || now - lastRead < 100) return;
    lastRead = now;
    readout(e.clientX, e.clientY);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { elev.textContent = 'Contour map · live'; });
}
