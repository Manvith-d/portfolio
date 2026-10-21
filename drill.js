// Saber drill: blaster bolts fly in from the right; move your blade to deflect them.
// Mouse / touch drag / arrow keys move the saber. Three misses end the drill.
import { say } from './main.js';

const stage = document.querySelector('.drill-stage');
const canvas = stage.querySelector('.drill-canvas');
const ctx = canvas.getContext('2d');
const overlay = stage.querySelector('.drill-overlay');
const msg = stage.querySelector('.drill-msg');
const startBtn = stage.querySelector('.drill-start');
const nowEl = document.querySelector('.drill-score .now');
const bestEl = document.querySelector('.drill-score .best');
const store = v => { try { return v === undefined ? localStorage.getItem('drill-best') : localStorage.setItem('drill-best', v); } catch { return null; } };

let W = 0, H = 0, dpr = 1, state = 'idle', raf = 0, last = 0;
let blade = { x: 60, y: 100, ty: 100 }, bolts = [], sparks = [], score = 0, lives = 3, best = +store() || 0, nextBolt = 0, flash = 0;
let col = {};
bestEl.textContent = best;

function colors() {
  const cs = getComputedStyle(document.documentElement);
  const light = document.documentElement.dataset.side === 'light';
  col = {
    saber: cs.getPropertyValue('--saber').trim(), core: cs.getPropertyValue('--saber-core').trim(),
    line: cs.getPropertyValue('--line').trim(), faint: cs.getPropertyValue('--faint').trim(),
    ink: cs.getPropertyValue('--ink').trim(), bolt: light ? '#c2410c' : '#ffb347',
  };
}
function size() {
  const r = stage.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width - 2; H = r.height - 2;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  blade.x = W < 500 ? 44 : 64;
  blade.y = blade.ty = Math.min(Math.max(blade.y, 30), H - 30);
  draw();
}
const clampY = y => Math.min(Math.max(y, 28), H - 28);

function spawn(now) {
  const speed = 260 + Math.min(score, 40) * 11;
  bolts.push({ x: W + 20, y: 26 + Math.random() * (H - 52), vx: -speed, vy: (Math.random() - 0.5) * 40, hit: false });
  nextBolt = now + Math.max(360, 1150 - score * 22) * (0.7 + Math.random() * 0.6);
}
function burst(x, y) {
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI - Math.PI / 2;
    sparks.push({ x, y, vx: Math.cos(a) * (120 + Math.random() * 200), vy: Math.sin(a) * (120 + Math.random() * 200), life: 1 });
  }
}

function step(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  blade.y += (blade.ty - blade.y) * (1 - Math.pow(0.0001, dt)); // fast, frame-rate independent follow
  if (now >= nextBolt) spawn(now);
  for (const b of bolts) {
    const px = b.x;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < 10 || b.y > H - 10) b.vy *= -1;
    // Crossed the blade this frame?
    if (!b.hit && px >= blade.x && b.x <= blade.x + 2) {
      if (Math.abs(b.y - blade.y) < 26) {
        b.hit = true; b.vx = Math.abs(b.vx) * 1.2; b.vy = (b.y - blade.y) * 9 + (Math.random() - 0.5) * 120;
        score++; nowEl.textContent = score; burst(blade.x + 4, b.y);
      }
    }
    if (!b.hit && b.x < -20) { b.dead = true; lives--; flash = 1; }
    if (b.hit && b.x > W + 40) b.dead = true;
  }
  bolts = bolts.filter(b => !b.dead);
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 2.4; }
  sparks = sparks.filter(s => s.life > 0);
  flash = Math.max(0, flash - dt * 3);
  if (lives <= 0) return end();
  draw();
  raf = requestAnimationFrame(step);
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // Range markings
  ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
  for (const y of [H * 0.25, H * 0.5, H * 0.75]) { ctx.beginPath(); ctx.moveTo(blade.x + 24, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.setLineDash([]);
  if (flash > 0) { ctx.fillStyle = `rgba(255,60,60,${flash * 0.18})`; ctx.fillRect(0, 0, W, H); }
  // Bolts
  ctx.lineCap = 'round';
  for (const b of bolts) {
    const len = 22, m = Math.hypot(b.vx, b.vy), ux = b.vx / m, uy = b.vy / m;
    ctx.shadowColor = col.bolt; ctx.shadowBlur = 10; ctx.strokeStyle = col.bolt; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - ux * len, b.y - uy * len); ctx.stroke();
  }
  // Sparks
  ctx.shadowBlur = 0;
  for (const s of sparks) { ctx.fillStyle = col.core; ctx.globalAlpha = s.life; ctx.fillRect(s.x, s.y, 2, 2); }
  ctx.globalAlpha = 1;
  // Saber: hilt + glowing blade
  const top = blade.y - 26, bottom = blade.y + 26;
  ctx.fillStyle = col.faint; ctx.fillRect(blade.x - 3, bottom, 6, 14);
  ctx.shadowColor = col.saber; ctx.shadowBlur = 18; ctx.strokeStyle = col.saber; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(blade.x, bottom); ctx.lineTo(blade.x, top); ctx.stroke();
  ctx.shadowBlur = 0; ctx.strokeStyle = col.core; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(blade.x, bottom); ctx.lineTo(blade.x, top); ctx.stroke();
  // Lives
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < lives ? col.saber : col.line;
    ctx.beginPath(); const x = W - 20 - i * 16, y = 16;
    ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill();
  }
}

function start() {
  if (state === 'play') return;
  colors();
  bolts = []; sparks = []; score = 0; lives = 3; flash = 0;
  nowEl.textContent = 0;
  state = 'play';
  overlay.hidden = true;
  stage.classList.add('playing');
  stage.focus({ preventScroll: true });
  last = performance.now(); nextBolt = last + 500;
  raf = requestAnimationFrame(step);
}
function end() {
  state = 'over';
  stage.classList.remove('playing');
  cancelAnimationFrame(raf);
  if (score > best) { best = score; store(best); bestEl.textContent = best; }
  draw();
  msg.textContent = score >= best && score > 0 ? `New best: ${score} deflected.` : `Drill complete: ${score} deflected.`;
  startBtn.querySelector('.mag').textContent = 'Run it again';
  overlay.hidden = false;
  say(`Drill over · ${score} deflected`);
}
function pause() {
  if (state !== 'play') return;
  state = 'paused';
  stage.classList.remove('playing');
  cancelAnimationFrame(raf);
  msg.textContent = 'Paused.';
  startBtn.querySelector('.mag').textContent = 'Resume';
  overlay.hidden = false;
}
function resume() {
  state = 'play'; overlay.hidden = true; stage.classList.add('playing'); stage.focus({ preventScroll: true });
  last = performance.now(); nextBolt = Math.max(nextBolt, last + 400);
  raf = requestAnimationFrame(step);
}

startBtn.addEventListener('click', e => { e.stopPropagation(); state === 'paused' ? resume() : start(); });
stage.addEventListener('pointermove', e => { blade.ty = clampY(e.clientY - stage.getBoundingClientRect().top); });
stage.addEventListener('pointerdown', e => {
  blade.ty = clampY(e.clientY - stage.getBoundingClientRect().top);
  if (state !== 'play' && e.target === canvas) state === 'paused' ? resume() : start();
});
stage.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'enter') { if (state !== 'play') { e.preventDefault(); state === 'paused' ? resume() : start(); } return; }
  if (k === 'arrowup' || k === 'w') { e.preventDefault(); blade.ty = clampY(blade.ty - 34); }
  if (k === 'arrowdown' || k === 's') { e.preventDefault(); blade.ty = clampY(blade.ty + 34); }
  if (state === 'idle' || state === 'over') draw();
});
// Pause when the drill scrolls away or the tab is hidden
new IntersectionObserver(([e]) => { if (!e.isIntersecting) pause(); }, { threshold: 0.3 }).observe(stage);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
addEventListener('sidechange', () => { colors(); if (state !== 'play') draw(); });
let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 150); });
colors();
size();
