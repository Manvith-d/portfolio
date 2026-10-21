// Side quest: one mini game per Side, sharing a stage.
//   Dark Side  · Saber drill: blaster bolts fly in; move your blade to deflect them. Three misses end it.
//   Light Side · Force stack: levitate stones into a tower; drop each one over the last. Overhangs are trimmed.
import { say } from './main.js';

const root = document.documentElement;
const stage = document.querySelector('.drill-stage');
const canvas = stage.querySelector('.drill-canvas');
const ctx = canvas.getContext('2d');
const overlay = stage.querySelector('.drill-overlay');
const msg = stage.querySelector('.drill-msg');
const startBtn = stage.querySelector('.drill-start');
const label = startBtn.querySelector('.mag');
const titleEl = document.querySelector('#drill-title');
const helpEl = document.querySelector('#drill-help');
const nowEl = document.querySelector('.drill-score .now');
const bestEl = document.querySelector('.drill-score .best');
const store = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };

let W = 0, H = 0, dpr = 1, state = 'idle', raf = 0, last = 0, score = 0, col = {}, game;
const sparks = [];
const clampY = y => Math.min(Math.max(y, 28), H - 28);
function burst(x, y, n = 10, up = false) {
  for (let i = 0; i < n; i++) {
    const a = up ? -Math.PI * Math.random() : Math.random() * Math.PI - Math.PI / 2;
    const v = 120 + Math.random() * 200;
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 });
  }
}
const point = () => { score++; nowEl.textContent = score; };

// ---- Dark Side: Saber drill -------------------------------------------------------------
const saberDrill = {
  id: 'dark', title: 'Saber drill', intro: 'Blaster bolts incoming. Hold your Side.',
  help: ['Move the mouse up and down, or use ↑ ↓ (W S).', 'Drag on the field to move your saber.', 'Three misses end the drill.'],
  reset() { this.blade = { x: W < 500 ? 44 : 64, y: H / 2, ty: H / 2 }; this.bolts = []; this.lives = 3; this.flash = 0; this.next = performance.now() + 500; },
  pointer(x, y) { this.blade.ty = clampY(y); },
  key(k) { if (k === 'arrowup' || k === 'w') this.blade.ty = clampY(this.blade.ty - 34); else if (k === 'arrowdown' || k === 's') this.blade.ty = clampY(this.blade.ty + 34); else return false; return true; },
  step(dt, now) {
    const b0 = this.blade;
    b0.y += (b0.ty - b0.y) * (1 - Math.pow(0.0001, dt));
    if (now >= this.next) {
      const speed = 260 + Math.min(score, 40) * 11;
      this.bolts.push({ x: W + 20, y: 26 + Math.random() * (H - 52), vx: -speed, vy: (Math.random() - 0.5) * 40, hit: false });
      this.next = now + Math.max(360, 1150 - score * 22) * (0.7 + Math.random() * 0.6);
    }
    for (const b of this.bolts) {
      const px = b.x;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < 10 || b.y > H - 10) b.vy *= -1;
      if (!b.hit && px >= b0.x && b.x <= b0.x + 2 && Math.abs(b.y - b0.y) < 26) {
        b.hit = true; b.vx = Math.abs(b.vx) * 1.2; b.vy = (b.y - b0.y) * 9 + (Math.random() - 0.5) * 120;
        point(); burst(b0.x + 4, b.y);
      }
      if (!b.hit && b.x < -20) { b.dead = true; this.lives--; this.flash = 1; }
      if (b.hit && b.x > W + 40) b.dead = true;
    }
    this.bolts = this.bolts.filter(b => !b.dead);
    this.flash = Math.max(0, this.flash - dt * 3);
    return this.lives > 0;
  },
  draw() {
    const b0 = this.blade;
    ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    for (const y of [H * 0.25, H * 0.5, H * 0.75]) { ctx.beginPath(); ctx.moveTo(b0.x + 24, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.setLineDash([]);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,60,60,${this.flash * 0.18})`; ctx.fillRect(0, 0, W, H); }
    ctx.lineCap = 'round';
    for (const b of this.bolts) {
      const m = Math.hypot(b.vx, b.vy), ux = b.vx / m, uy = b.vy / m;
      ctx.shadowColor = col.bolt; ctx.shadowBlur = 10; ctx.strokeStyle = col.bolt; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - ux * 22, b.y - uy * 22); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const top = b0.y - 26, bottom = b0.y + 26;
    ctx.fillStyle = col.faint; ctx.fillRect(b0.x - 3, bottom, 6, 14);
    ctx.shadowColor = col.saber; ctx.shadowBlur = 18; ctx.strokeStyle = col.saber; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(b0.x, bottom); ctx.lineTo(b0.x, top); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = col.core; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b0.x, bottom); ctx.lineTo(b0.x, top); ctx.stroke();
    lives(this.lives);
  },
  over: n => `Drill complete: ${n} deflected.`,
};

// ---- Light Side: Force stack -----------------------------------------------------------
const forceStack = {
  id: 'light', title: 'Force stack', intro: 'Steady your focus. Raise the tower.',
  help: ['Click, or press Space, to set each stone.', 'Tap the field to set each stone.', 'Set it over the stone below: overhangs are trimmed.'],
  reset() {
    const w = Math.min(W * 0.42, 260);
    this.h = 18; this.stones = [{ x: (W - w) / 2, w }]; this.debris = []; this.view = 0; this.perfect = 0;
    this.spawn();
  },
  spawn() {
    // The stone sweeps back and forth over a band around the tower, a little faster each time
    const prev = this.stones.at(-1), reach = Math.max(prev.w * 1.3, 90);
    const lo = Math.max(4, prev.x - reach), hi = Math.min(W - 4, prev.x + prev.w + reach);
    const speed = Math.max(150, (hi - lo) * 0.55) + Math.min(score, 30) * 10;
    const fromLeft = Math.random() < 0.5;
    this.moving = { x: fromLeft ? lo : hi - prev.w, w: prev.w, dir: fromLeft ? 1 : -1, speed, t: 0, lo, hi };
  },
  topY(i) { return H - 16 - (i + 1) * this.h + this.view; },
  drop() {
    const m = this.moving, prev = this.stones.at(-1);
    if (Math.abs(m.x - prev.x) < 4) m.x = prev.x; // a near-perfect drop snaps into place
    const left = Math.max(m.x, prev.x), right = Math.min(m.x + m.w, prev.x + prev.w);
    const y = this.topY(this.stones.length);
    if (right - left <= 2) { this.debris.push({ x: m.x, y, w: m.w, vy: 0, life: 1 }); this.moving = null; this.dead = true; return; }
    if (m.x < left) this.debris.push({ x: m.x, y, w: left - m.x, vy: 0, life: 1 });
    if (m.x + m.w > right) this.debris.push({ x: right, y, w: m.x + m.w - right, vy: 0, life: 1 });
    const perfect = m.x === prev.x && m.w === prev.w;
    this.stones.push({ x: left, w: right - left });
    point();
    if (perfect) { this.perfect = 1; burst(left + (right - left) / 2, y, 14, true); }
    this.spawn();
  },
  pointer() {},
  tap() { if (this.moving) this.drop(); },
  key(k) { if (k === ' ' || k === 'enter' || k === 'arrowdown') { this.tap(); return true; } return false; },
  step(dt) {
    const m = this.moving;
    if (m) {
      m.t += dt;
      m.x += m.dir * m.speed * dt;
      if (m.x + m.w > m.hi && m.dir > 0) m.dir = -1;
      if (m.x < m.lo && m.dir < 0) m.dir = 1;
    }
    // Keep the top of the tower in view
    const want = Math.max(0, (this.stones.length + 2) * this.h - H * 0.65);
    this.view += (want - this.view) * Math.min(1, dt * 4);
    for (const d of this.debris) { d.vy += 900 * dt; d.y += d.vy * dt; d.life -= dt * 1.2; }
    this.debris = this.debris.filter(d => d.life > 0 && d.y < H + 40);
    this.perfect = Math.max(0, this.perfect - dt * 1.5);
    return !this.dead || this.debris.length > 0;
  },
  draw() {
    const r = 4;
    const stone = (x, y, w, alpha = 1, glow = 0) => {
      ctx.globalAlpha = alpha;
      ctx.shadowColor = col.saber; ctx.shadowBlur = glow;
      ctx.fillStyle = col.stone; ctx.strokeStyle = col.accent; ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.roundRect(x, y, w, this.h - 3, r); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    };
    // Ground line
    ctx.strokeStyle = col.line; ctx.beginPath(); ctx.moveTo(0, H - 14 + this.view); ctx.lineTo(W, H - 14 + this.view); ctx.stroke();
    this.stones.forEach((s, i) => stone(s.x, this.topY(i), s.w, 1, i === this.stones.length - 1 ? 8 + this.perfect * 18 : 0));
    if (this.moving) {
      const y = this.topY(this.stones.length) - 4 - Math.sin(this.moving.t * 4) * 2; // floats while it waits
      stone(this.moving.x, y, this.moving.w, 1, 14);
    }
    for (const d of this.debris) stone(d.x, d.y, d.w, Math.max(0, d.life), 0);
    if (this.perfect > 0.4) { ctx.fillStyle = col.accent; ctx.font = '500 10px "Geist Mono", monospace'; ctx.fillText('PERFECT', W - 76, 22); }
  },
  over: n => `Tower complete: ${n} ${n === 1 ? 'stone' : 'stones'} high.`,
};

const games = { dark: saberDrill, light: forceStack };
function lives(n) {
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < n ? col.saber : col.line;
    const x = W - 20 - i * 16, y = 16;
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.fill();
  }
}

// ---- Host ------------------------------------------------------------------------------
function colors() {
  const cs = getComputedStyle(root), light = root.dataset.side === 'light';
  const v = n => cs.getPropertyValue(n).trim();
  col = { saber: v('--saber'), core: v('--saber-core'), line: v('--line'), faint: v('--faint'), accent: v('--accent'), stone: v('--surface-2'), bolt: light ? '#c2410c' : '#ffb347' };
}
const bestKey = () => `drill-best-${game.id}`;
function pick() {
  game = games[root.dataset.side === 'light' ? 'light' : 'dark'];
  titleEl.textContent = game.title;
  stage.dataset.game = game.id;
  helpEl.innerHTML = `<span class="fine-only">${game.help[0]}</span><span class="touch-only">${game.help[1]}</span> ${game.help[2]}`;
  bestEl.textContent = +store(bestKey()) || 0;
  nowEl.textContent = 0;
  msg.textContent = game.intro;
  label.textContent = 'Start';
  overlay.hidden = false;
  state = 'idle';
  game.reset();
}
function size() {
  const r = stage.getBoundingClientRect();
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = r.width - 2; H = r.height - 2;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  if (state !== 'play') game.reset();
  draw();
}
function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  game.draw();
  for (const s of sparks) { ctx.fillStyle = col.core === '#f4ffe8' ? col.accent : col.core; ctx.globalAlpha = s.life; ctx.fillRect(s.x, s.y, 2, 2); }
  ctx.globalAlpha = 1;
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const alive = game.step(dt, now);
  for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 300 * dt; s.life -= dt * 2.4; }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life <= 0) sparks.splice(i, 1);
  draw();
  if (!alive) return end();
  raf = requestAnimationFrame(frame);
}
function start() {
  if (state === 'play') return;
  if (state === 'paused') return resume();
  colors();
  score = 0; nowEl.textContent = 0; sparks.length = 0;
  game.dead = false;
  game.reset();
  run();
}
function run() {
  state = 'play';
  overlay.hidden = true;
  stage.classList.add('playing');
  stage.focus({ preventScroll: true });
  last = performance.now();
  raf = requestAnimationFrame(frame);
}
const resume = run;
function end() {
  state = 'over';
  stage.classList.remove('playing');
  cancelAnimationFrame(raf);
  const best = +store(bestKey()) || 0;
  if (score > best) { store(bestKey(), score); bestEl.textContent = score; }
  msg.textContent = score > best && score > 0 ? `New best! ${game.over(score)}` : game.over(score);
  label.textContent = 'Play again';
  overlay.hidden = false;
  say(`${game.title} · ${score}`);
}
function pause() {
  if (state !== 'play') return;
  state = 'paused';
  stage.classList.remove('playing');
  cancelAnimationFrame(raf);
  msg.textContent = 'Paused.';
  label.textContent = 'Resume';
  overlay.hidden = false;
}

const local = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
startBtn.addEventListener('click', e => { e.stopPropagation(); start(); });
stage.addEventListener('pointermove', e => game.pointer(...local(e)));
stage.addEventListener('pointerdown', e => {
  if (e.target !== canvas) return;
  if (state !== 'play') return start();
  game.pointer(...local(e));
  game.tap?.();
});
stage.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (state !== 'play') { if (k === ' ' || k === 'enter') { e.preventDefault(); start(); } return; }
  if (game.key(k)) e.preventDefault();
});
new IntersectionObserver(([e]) => { if (!e.isIntersecting) pause(); }, { threshold: 0.3 }).observe(stage);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
// Switching Sides switches the game
addEventListener('sidechange', () => {
  colors();
  if (state === 'play' || state === 'paused') { cancelAnimationFrame(raf); stage.classList.remove('playing'); }
  sparks.length = 0;
  pick();
  draw();
});
let rt;
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 150); });
colors();
pick();
size();
