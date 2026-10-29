// Contour field: topographic isolines of a slowly drifting scalar field, traced with
// marching squares. Ambient only: it drifts and follows the scroll, never the pointer.
import { onFrame, still } from './main.js';

const canvas = document.querySelector('.field');
const ctx = canvas.getContext('2d');
const LEVELS = 8;
const lost = document.body.classList.contains('lost-page'); // 404: a flatter map with one bright ring
let W = 0, H = 0, dpr = 1, cell = 28, cols = 0, rows = 0, vals = new Float32Array(0);
let rgb = '255,42,42', alpha = 0.16, lastDraw = -1e9, lastScroll = 0;
// The field keeps its own clock so pausing while idle never makes the map jump on resume
let clock = 0, bloom = still ? 1 : 0;
const t0 = performance.now();

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

// Height of the map at one screen point: drifting terrain
function fieldAt(px, py, t) {
  const x = px / 200, y = (py + scrollY * 0.12) / 200;
  let f = (lost ? 0.45 : 1) * bloom * (Math.sin(x * 0.9 + t * 0.07) * Math.cos(y * 1.1 - t * 0.05) + 0.55 * Math.sin((x + y) * 1.7 + t * 0.03) + 0.35 * Math.cos(x * 2.3 - y * 1.3));
  if (lost) { const dx = px - W / 2, dy = py - H / 2; f += 1.2 * Math.exp(-(dx * dx + dy * dy) / (2 * 140 * 140)); }
  return f;
}
function sample(t) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) vals[j * cols + i] = fieldAt(i * cell, j * cell, t);
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
  sample(clock);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (let k = 0; k < LEVELS; k++) {
    const l = -1.6 + (k * 3.2) / (LEVELS - 1), index = k % 4 === 3, a = index ? alpha * 1.9 : alpha;
    ctx.lineWidth = index ? 1.25 : 1;
    ctx.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`;
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
  onFrame(now => {
    // Draw at 20 fps while scrolling or blooming in, drift at 5 fps for a few seconds after, then stop
    const busy = now - lastScroll < 600 || bloom < 1;
    const idle = now - lastScroll > 4000;
    if (busy ? now - lastDraw >= 50 : !idle && now - lastDraw >= 200) draw(now);
  });
}
