// Target-lock cursor (fine pointers only): an exact-position pip, corner brackets that snap
// around what you're about to click, a short saber streak on fast moves, and a 4px button magnet.
import { P, onFrame, still, ease } from './main.js';

const root = document.documentElement;
const el = document.createElement('div');
el.className = 'cur s-default hide';
el.setAttribute('aria-hidden', 'true');
el.innerHTML = '<i class="cur-trail"></i><i class="cur-c tl"></i><i class="cur-c tr"></i><i class="cur-c bl"></i><i class="cur-c br"></i><i class="cur-pip"></i><span class="cur-tag"></span>';
const [trail, tl, tr, bl, br, pip, tag] = el.children;

let on = false, wanted = false, target = null, state = 'default', mag = null, pressed = false, fresh = true;
const box = [0, 0, 0, 0], tail = { x: 0, y: 0 }, magOff = { x: 0, y: 0 };
const store = v => { try { return v === undefined ? localStorage.getItem('cursor') : localStorage.setItem('cursor', v); } catch { return null; } };

function setState(next, t = null) {
  if (mag && (!t || !t.contains(mag))) { mag.style.transition = ''; mag.style.transform = ''; mag = null; }
  target = t;
  state = next;
  el.className = `cur s-${next}${pressed ? ' press' : ''}`;
  const label = t?.dataset.tag ?? (t?.matches('[role=tab]') ? (t.getAttribute('aria-selected') === 'true' ? 'VIEWING' : 'OPEN ↵') : next === 'file' ? 'OPEN ↵' : '');
  tag.textContent = label;
  tag.classList.toggle('on', !!label);
  const m = t?.querySelector(':scope > .mag');
  if (m && !still) { mag = m; m.style.transition = 'none'; }
}

function resolve(node) {
  if (!(node instanceof Element)) return setState('default');
  if (node.closest('input, textarea, select, [contenteditable], dialog')) return setState('field');
  const hit = node.closest('[role=tab], [data-cur], a, button, summary, abbr, label');
  if (hit) {
    if (hit.matches('[role=tab], [data-cur]')) return setState('file', hit);
    if (hit.matches('a:not(.btn)')) return setState('link', hit);
    return setState('button', hit);
  }
  if (node.closest('p, li, dd, dt, h1, h2, h3, h4, blockquote, figcaption')) return setState('text');
  setState('default');
}

// A failure here must hand the native cursor back, never leave the page without one
function tick(now, dt) {
  try { step(now, dt); } catch (err) { wanted = false; apply(); throw err; } // off for this visit only
}
function step(now, dt) {
  if (!on) return;
  const hidden = !P.active || P.type !== 'mouse' || state === 'field' || document.querySelector('dialog[open]');
  el.classList.toggle('hide', !!hidden);
  if (hidden) { fresh = true; return; }
  let x0, y0, x1, y1;
  if (target && target.isConnected && state !== 'text') {
    const r = target.getBoundingClientRect(), pad = state === 'link' ? 4 : state === 'button' ? 6 : 0;
    [x0, y0, x1, y1] = [r.left - pad, r.top - pad, r.right + pad, r.bottom + pad];
  } else [x0, y0, x1, y1] = [P.x - 7, P.y - 7, P.x + 7, P.y + 7];
  if (pressed) { x0 += 3; y0 += 3; x1 -= 3; y1 -= 3; }
  const k = fresh ? 1 : ease(0.28, dt);
  box[0] += (x0 - box[0]) * k; box[1] += (y0 - box[1]) * k; box[2] += (x1 - box[2]) * k; box[3] += (y1 - box[3]) * k;
  if (fresh) { tail.x = P.x; tail.y = P.y; fresh = false; }
  const t3 = (n, x, y, extra = '') => { n.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)${extra}`; };
  t3(pip, P.x, P.y);
  t3(tl, box[0], box[1]); t3(tr, box[2], box[1]); t3(bl, box[0], box[3]); t3(br, box[2], box[3]);
  t3(tag, box[0], box[1]);
  // Saber streak: a tail that lags behind the pip, visible only while moving fast
  if (!still) {
    const kt = ease(0.18, dt);
    tail.x += (P.x - tail.x) * kt; tail.y += (P.y - tail.y) * kt;
    const dx = P.x - tail.x, dy = P.y - tail.y, len = Math.min(Math.hypot(dx, dy), 56);
    t3(trail, P.x, P.y, ` rotate(${Math.atan2(-dy, -dx)}rad) scaleX(${(len / 56).toFixed(3)})`);
    trail.style.opacity = (Math.min(len / 56, 1) * (state === 'default' || state === 'text' ? 0.7 : 0.3)).toFixed(2);
    // Magnet: the inner .mag span drifts toward the pointer, at most 4px
    if (mag && target) {
      const r = target.getBoundingClientRect();
      const cap = v => Math.max(-4, Math.min(4, v));
      const km = ease(0.2, dt);
      magOff.x += (cap((P.x - (r.left + r.width / 2)) * 0.22) - magOff.x) * km;
      magOff.y += (cap((P.y - (r.top + r.height / 2)) * 0.22) - magOff.y) * km;
      mag.style.transform = `translate(${magOff.x.toFixed(2)}px,${magOff.y.toFixed(2)}px)`;
    } else magOff.x = magOff.y = 0;
  }
}

export function toggle(force) {
  wanted = force ?? !wanted;
  store(wanted ? 'on' : 'off');
  apply();
  return wanted;
}
// The native cursor is only hidden once a real mouse has moved, so a resting pointer is never invisible
function apply() {
  on = wanted && P.type === 'mouse' && P.last > 0;
  root.classList.toggle('cur-on', on);
  if (!on) setState('default');
}

export function init() {
  document.body.append(el);
  document.addEventListener('pointerover', e => resolve(e.target), { passive: true });
  addEventListener('pointerdown', () => { pressed = true; el.classList.add('press'); }, { passive: true });
  addEventListener('pointerup', () => { pressed = false; el.classList.remove('press'); }, { passive: true });
  addEventListener('blur', () => { P.active = false; });
  // Re-resolve after content swaps under a still pointer (archive tabs, Guru, filters)
  addEventListener('click', () => requestAnimationFrame(() => resolve(document.elementFromPoint(P.x, P.y))));
  onFrame(tick);
  wanted = store() === 'on'; // opt-in with C: a cursor that follows the pointer reads as a template default
  addEventListener('pointermove', e => { if ((e.pointerType === 'mouse') !== on && wanted) apply(); }, { passive: true });
}
