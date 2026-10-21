// Survey Console core: shared pointer + frame loop, Sides, nav, reveals, archive, contact, shortcuts.
// The contour field (field.js) and target-lock cursor (cursor.js) load on demand.
const root = document.documentElement;
export const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const forced = matchMedia('(forced-colors: active)').matches;
const fine = matchMedia('(pointer: fine) and (hover: hover)');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const store = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };

// One pointer state and one rAF loop for everything that moves. A failing tick removes itself.
export const P = { x: -1e4, y: -1e4, active: false, last: 0, type: 'mouse' };
const ticks = new Set();
export const onFrame = fn => ticks.add(fn);
let lastT = 0;
requestAnimationFrame(function frame(now) {
  const dt = Math.min(now - lastT || 16.7, 64);
  lastT = now;
  for (const fn of ticks) { try { fn(now, dt); } catch (err) { console.warn('frame task disabled', err); ticks.delete(fn); } }
  requestAnimationFrame(frame);
});
addEventListener('pointermove', e => Object.assign(P, { x: e.clientX, y: e.clientY, active: true, last: performance.now(), type: e.pointerType }), { passive: true });
document.addEventListener('pointerleave', () => { P.active = false; });
export const ease = (base, dt) => (still ? 1 : 1 - Math.pow(1 - base, dt / 16.67));

// Toast
const toast = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast' }));
toast.setAttribute('role', 'status');
export function say(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(say.t);
  say.t = setTimeout(() => toast.classList.remove('show'), 1800);
}

// Light Side / Dark Side
const saber = $('.saber');
const icon = $('link[rel=icon]');
const favicon = side => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${side === 'light' ? '#f6f1e7' : '#0b0b0e'}"/><rect x="4" y="13.5" width="7" height="5" rx="1" fill="#8e878b"/><rect x="11" y="14.5" width="17" height="3" rx="1.5" fill="${side === 'light' ? '#2a7419' : '#ff2a2a'}"/></svg>`);
function syncSide() {
  const dark = root.dataset.side !== 'light';
  saber?.setAttribute('aria-label', `Switch to the ${dark ? 'Light' : 'Dark'} Side`);
  const label = $('.saber-label', saber ?? document);
  if (label) label.textContent = dark ? 'Dark Side' : 'Light Side';
  $('meta[name=theme-color]').content = dark ? '#0b0b0e' : '#f6f1e7';
  if (icon) icon.href = favicon(root.dataset.side);
  dispatchEvent(new Event('sidechange'));
}
const wait = ms => new Promise(r => setTimeout(r, ms));
export async function switchSide() {
  if (switchSide.busy) return;
  switchSide.busy = true;
  try { await runSwitch(); } finally { switchSide.busy = false; }
}
async function runSwitch() {
  const next = root.dataset.side === 'light' ? 'dark' : 'light';
  const apply = () => { root.dataset.side = next; store('side', next); syncSide(); };
  const done = () => say(next === 'dark' ? 'Dark Side engaged' : 'Light Side engaged');
  if (still || !document.startViewTransition || !saber) { apply(); return done(); }
  const blade = $('.blade', saber).getBoundingClientRect();
  const tx = blade.right, ty = blade.top + blade.height / 2;
  root.style.setProperty('--tx', `${tx}px`);
  root.style.setProperty('--ty', `${ty}px`);
  root.style.setProperty('--r', `${Math.hypot(Math.max(tx, innerWidth - tx), Math.max(ty, innerHeight - ty))}px`);
  saber.classList.remove('ignite');
  saber.classList.add('off');
  await wait(120);
  const vt = document.startViewTransition(apply);
  vt.ready.catch(() => {}); // the browser may skip the animation (hidden tab etc.); the theme still applies
  await vt.finished.catch(() => {});
  saber.classList.remove('off');
  saber.classList.add('ignite');
  burst(tx, ty);
  done();
}
// A small shockwave from the blade tip as it re-ignites
function burst(x, y) {
  const ring = document.body.appendChild(Object.assign(document.createElement('i'), { className: 'wipe-ring' }));
  ring.animate([{ transform: `translate(${x}px,${y}px) scale(1)`, opacity: 1 }, { transform: `translate(${x}px,${y}px) scale(90)`, opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' }).finished.then(() => ring.remove());
}
syncSide();
saber?.addEventListener('click', switchSide);
$('.menu-side')?.addEventListener('click', switchSide);

// Saber senses the pointer: the blade glow brightens as you approach
if (saber && fine.matches && !still) {
  const bladeEl = $('.blade', saber);
  let r = bladeEl.getBoundingClientRect(), lastGlow = '';
  addEventListener('resize', () => (r = bladeEl.getBoundingClientRect()), { passive: true });
  onFrame(() => {
    if (!P.active) return;
    const d = Math.hypot(P.x - (r.left + r.width / 2), P.y - (r.top + r.height / 2));
    const g = (0.55 + 0.45 * Math.max(0, 1 - d / 160)).toFixed(2);
    if (g !== lastGlow) bladeEl.style.setProperty('--glow', (lastGlow = g));
  });
}

// Status bar: background after scrolling, edge blade progress, active section marker
const bar = $('.bar');
const edge = $('.edge-blade');
const post = $('.post');
function onScroll() {
  bar?.classList.toggle('scrolled', scrollY > 24);
  if (!edge) return;
  let p;
  if (post) {
    const r = post.getBoundingClientRect();
    p = (-r.top) / Math.max(1, r.height - innerHeight);
  } else p = scrollY / Math.max(1, root.scrollHeight - innerHeight);
  edge.style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(4));
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const navLinks = $$('.nav a');
const navBlade = $('.nav-blade');
const crumb = $('.crumb');
function markNav(id) {
  const active = navLinks.find(a => a.hash === `#${id}`);
  [...navLinks, ...$$('#menu ol a')].forEach(a => (a.hash === active?.hash ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  // On narrow screens the tabs scroll sideways: keep the active one in view
  const nav = navBlade?.parentElement;
  if (active && nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: active.offsetLeft - 24, behavior: still ? 'auto' : 'smooth' });
  if (navBlade) {
    if (active) {
      navBlade.style.setProperty('--nx', `${active.offsetLeft}px`); // relative to the (scrolling) nav
      navBlade.style.setProperty('--nw', (active.offsetWidth / 100).toFixed(3));
    } else navBlade.style.setProperty('--nw', 0);
  }
  if (crumb) crumb.textContent = active ? `/ ${active.querySelector('b').textContent} ${active.lastChild.textContent}` : '';
}
const sections = $$('main section[id]');
if (sections.length && navLinks.length) {
  const io = new IntersectionObserver(entries => entries.forEach(e => e.isIntersecting && markNav(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(s => io.observe(s));
  addEventListener('resize', () => markNav($('.nav a[aria-current]')?.hash.slice(1)));
} else if (crumb && post) crumb.textContent = '/ 03 Writing';

// Mobile menu sheet
const menu = $('#menu');
const menuBtn = $('.menu-open');
if (menu && menuBtn) {
  menuBtn.hidden = false;
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.addEventListener('click', () => { menu.showModal(); menuBtn.setAttribute('aria-expanded', 'true'); });
  menu.addEventListener('close', () => menuBtn.setAttribute('aria-expanded', 'false'));
  $('.menu-close', menu).addEventListener('click', () => menu.close());
  $$('a', menu).forEach(a => a.addEventListener('click', () => menu.close()));
}

// Reveals below the fold, with a safety net so nothing stays hidden in throttled tabs
const reveal = el => {
  if (el.classList.contains('in')) return;
  el.classList.add('in');
  el.dispatchEvent(new Event('revealed'));
};
const io = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return;
  reveal(e.target);
  io.unobserve(e.target);
}), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach(el => io.observe(el));
setTimeout(() => $$('.reveal:not(.in)').forEach(el => { if (el.getBoundingClientRect().top < innerHeight * 1.5) reveal(el); }), 3000);

// 1,000+ counts up once; the final text is already in the HTML
function countUp(el) {
  const m = el.textContent.match(/^([\d,]+)(.*)$/);
  if (!m || still) return;
  const end = +m[1].replace(/,/g, ''), t0 = performance.now();
  const tick = now => {
    const p = Math.min((now - t0) / 1200, 1);
    el.textContent = Math.round(end * (1 - (1 - p) ** 3)).toLocaleString('en-US') + m[2];
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
$$('[data-count]').forEach(el => el.closest('.reveal')?.addEventListener('revealed', () => countUp(el), { once: true }));

// Timeline: the spine charges and nodes light as you scroll through it
const timeline = $('.timeline');
if (timeline) {
  const items = $$('li', timeline);
  const charge = () => {
    const r = timeline.getBoundingClientRect();
    const p = still ? 1 : Math.min(1, Math.max(0, (innerHeight * 0.65 - r.top) / r.height));
    timeline.style.setProperty('--tf', p.toFixed(3));
    items.forEach(li => li.classList.toggle('lit', li.offsetTop <= p * r.height));
  };
  addEventListener('scroll', charge, { passive: true });
  charge();
}

// Name sheen and badge foil follow the pointer
if (fine.matches) {
  const name = $('.name');
  name?.addEventListener('pointermove', e => {
    const r = name.getBoundingClientRect();
    name.style.setProperty('--hx', `${e.clientX - r.left}px`);
    name.style.setProperty('--hy', `${e.clientY - r.top}px`);
  });
  $$('.badge').forEach(b => b.addEventListener('pointermove', e => {
    const r = b.getBoundingClientRect();
    b.style.setProperty('--foil', `${((e.clientX - r.left) / r.width) * 100}%`);
  }));
}

// Touch delight: a saber ring where you tap
if (!fine.matches && !still) {
  const ripple = document.body.appendChild(Object.assign(document.createElement('i'), { className: 'ripple' }));
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !e.target.closest('a, button, summary, [role=tab]')) return;
    ripple.style.setProperty('--rx', `${e.clientX}px`);
    ripple.style.setProperty('--ry', `${e.clientY}px`);
    ripple.classList.remove('go'); void ripple.offsetWidth; ripple.classList.add('go');
  }, { passive: true });
}

// AbDiffuser schematic: 28 points settle from noise into a double strand
const diffusion = $('.diffusion');
if (diffusion) {
  const svg = $('svg', diffusion), ns = 'http://www.w3.org/2000/svg';
  const strand = (s, t) => [60 + t * 400, 125 + (s ? -1 : 1) * 46 * Math.sin(t * Math.PI * 2.5)];
  const path = s => Array.from({ length: 41 }, (_, k) => strand(s, k / 40)).map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  let html = `<path class="strand" d="${path(0)}"/><path class="strand" d="${path(1)}"/>`;
  for (let k = 0; k < 14; k++) { const [x, y0] = strand(0, k / 13), [, y1] = strand(1, k / 13); html += `<path class="rung" d="M${x.toFixed(1)} ${y0.toFixed(1)}V${y1.toFixed(1)}"/>`; }
  for (let i = 0; i < 28; i++) {
    const [x1, y1] = strand(i % 2, Math.floor(i / 2) / 13);
    html += `<circle class="dot" r="4" style="--i:${i};--x0:${(20 + Math.random() * 480).toFixed(0)};--y0:${(20 + Math.random() * 210).toFixed(0)};--x1:${x1.toFixed(1)};--y1:${y1.toFixed(1)}"/>`;
  }
  svg.innerHTML = html;
  const form = () => diffusion.classList.add('formed');
  const dossier = diffusion.closest('.reveal');
  if (still || !dossier || dossier.classList.contains('in')) form(); else dossier.addEventListener('revealed', () => setTimeout(form, 200), { once: true });
  if (fine.matches && !still) diffusion.parentElement.addEventListener('pointerenter', () => {
    diffusion.classList.remove('formed');
    setTimeout(form, 450);
  });
}

// Case-file archive: tabs on wide screens, accordion on narrow, filters and deep links on both
const archive = $('.archive');
const files = $$('.archive .file');
const wide = matchMedia('(min-width: 900px)');
let filter = 'all', selected = files[0], mode = null;
const toolsOf = new Map(); // card -> Set of tool names from its STACK line
const shown = () => files.filter(f => filter === 'all' || (filter.startsWith('tool:') ? toolsOf.get(f)?.has(filter.slice(5)) : f.dataset.domain.split(' ').includes(filter)));
const kindOf = f => $('.kind', f)?.textContent ?? '';
function select(file, { focus = false, user = false } = {}) {
  if (!file) return;
  selected = file;
  if (mode === 'tabs') {
    files.forEach(f => {
      const on = f === file, tab = $(`#t-${f.id}`);
      f.hidden = !on;
      tab.setAttribute('aria-selected', on);
      tab.tabIndex = on ? 0 : -1;
      if (on && focus) tab.focus({ preventScroll: true });
    });
  } else if (mode === 'accordion') {
    files.forEach(f => {
      const on = f === file && !(user && f.classList.contains('open'));
      f.classList.toggle('open', on);
      $('.file-toggle', f).setAttribute('aria-expanded', on);
      $('.file-body', f).hidden = !on;
    });
    if (focus) $('.file-toggle', file).focus({ preventScroll: true });
  }
  if (user) history.replaceState(null, '', `#${file.id}`);
}
function build() {
  const next = wide.matches ? 'tabs' : 'accordion';
  if (next === mode) return;
  teardown();
  mode = next;
  archive.classList.add(mode);
  if (mode === 'tabs') {
    const list = Object.assign(document.createElement('div'), { className: 'tablist' });
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-orientation', 'vertical');
    list.setAttribute('aria-label', 'Case files');
    const panels = Object.assign(document.createElement('div'), { className: 'panels' });
    files.forEach(f => {
      const tab = document.createElement('button');
      Object.assign(tab, { type: 'button', id: `t-${f.id}`, className: 'tab' });
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', f.id);
      tab.dataset.cur = 'file';
      tab.innerHTML = `<span class="n">${$('.n', f).textContent}</span><span class="t">${$('h3', f).textContent}</span><span class="kind">${kindOf(f)}</span>`;
      tab.addEventListener('click', () => select(f, { user: true }));
      list.append(tab);
      $('.file-head', f).dataset.case = `CASE FILE ${$('.n', f).textContent} · ${$('.kicker', f)?.textContent ?? ''}`;
      f.setAttribute('role', 'tabpanel');
      f.setAttribute('aria-labelledby', tab.id);
      f.tabIndex = 0;
      panels.append(f);
    });
    list.addEventListener('keydown', e => {
      const vis = shown(), from = files.find(f => document.activeElement?.id === `t-${f.id}`) ?? selected, i = vis.indexOf(from);
      const to = { ArrowDown: vis[i + 1], ArrowUp: vis[i - 1], Home: vis[0], End: vis.at(-1) }[e.key];
      if (!to) return;
      e.preventDefault();
      select(to, { focus: true, user: true });
    });
    archive.append(list, panels);
    // Reserve the tallest file's height so switching never makes the page jump
    const measure = () => {
      let tallest = 0;
      files.forEach(f => { const h = f.hidden; f.hidden = false; tallest = Math.max(tallest, f.offsetHeight); f.hidden = h; });
      panels.style.setProperty('--panel-h', `${tallest}px`);
    };
    measure();
    document.fonts?.ready.then(measure);
  } else {
    files.forEach(f => {
      const h3 = $('h3', f), body = $('.file-body', f);
      body.id ||= `${f.id}-body`;
      const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'file-toggle' });
      btn.setAttribute('aria-controls', body.id);
      btn.append(...h3.childNodes);
      h3.append(btn);
      btn.addEventListener('click', () => select(f, { user: true }));
    });
  }
  applyFilter();
  select(selected);
}
function teardown() {
  if (!mode) return;
  archive.classList.remove(mode);
  files.forEach(f => {
    f.hidden = false;
    f.classList.remove('open');
    ['role', 'aria-labelledby', 'tabindex'].forEach(a => f.removeAttribute(a));
    const btn = $('.file-toggle', f);
    if (btn) btn.replaceWith(...btn.childNodes);
    $('.file-body', f).hidden = false;
    archive.append(f);
  });
  $$('.tablist, .panels', archive).forEach(n => n.remove());
}
function applyFilter() {
  const vis = shown();
  files.forEach(f => {
    const out = !vis.includes(f);
    f.toggleAttribute('data-out', out);
    if (mode === 'tabs') $(`#t-${f.id}`).hidden = out;
    else f.hidden = out;
  });
  if (!vis.includes(selected)) select(vis[0]);
  else if (mode === 'tabs') select(selected);
}
if (archive && files.length) {
  const tools = $('.archive-tools');
  tools.hidden = false;
  $$('[data-filter]', tools).forEach(b => {
    const f = b.dataset.filter;
    b.insertAdjacentHTML('beforeend', `<sup>${f === 'all' ? files.length : files.filter(x => x.dataset.domain.split(' ').includes(f)).length}</sup>`);
    b.addEventListener('click', () => {
      filter = f;
      clearLens();
      $$('[data-filter]', tools).forEach(x => x.setAttribute('aria-pressed', x === b));
      applyFilter();
      $('#archive-status').textContent = `Showing ${shown().length} of ${files.length} case files`;
    });
  });
  const fromHash = () => files.find(f => `#${f.id}` === location.hash);
  selected = fromHash() ?? files[0];
  build();
  wide.addEventListener('change', build);
  // Guru's "Go to section" can open a specific file
  addEventListener('archive:open', e => {
    const f = files.find(x => x.id === e.detail);
    if (!f) return;
    if (!shown().includes(f)) $('[data-filter=all]').click();
    select(f, { user: true, focus: true });
    f.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  });
  if (fromHash()) setTimeout(() => selected.scrollIntoView({ block: 'start' }), 100);
}

// Contact: copy the email address
const copy = $('.copy');
if (copy && navigator.clipboard) {
  copy.hidden = false;
  const label = $('.mag', copy);
  copy.addEventListener('click', () => {
    const email = $('.mail').textContent.trim();
    navigator.clipboard.writeText(email).then(() => {
      label.textContent = 'Copied ✓';
      say('Email copied');
      setTimeout(() => (label.textContent = 'Copy'), 1600);
    }, () => (location.href = `mailto:${email}`));
  });
}

// Keyboard shortcuts (single keys can be switched off, per WCAG 2.1.4)
const keys = $('#keys');
const keysOff = $('#keys-off');
let cursorApi = null;
if (keys) {
  $('.keys-open').hidden = false;
  $('.keys-open').addEventListener('click', () => keys.showModal());
  $('.close', keys).addEventListener('click', () => keys.close());
  keysOff.checked = store('keys-off') === '1';
  keysOff.addEventListener('change', () => store('keys-off', keysOff.checked ? '1' : '0'));
}
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]:not(#keys)')) return;
  if (store('keys-off') === '1' && e.key !== '?') return;
  const k = e.key.toLowerCase();
  if (k === 't') switchSide();
  else if (k === '?' && keys) keys.open ? keys.close() : keys.showModal();
  else if (k === 'c' && cursorApi) say(cursorApi.toggle() ? 'Cursor on' : 'Cursor off');
  else if ((k === 'j' || k === 'k') && mode && (archive.contains(document.activeElement) || (archive.getBoundingClientRect().top < innerHeight && archive.getBoundingClientRect().bottom > 0))) {
    const vis = shown(), i = vis.indexOf(selected);
    const to = vis[(i + (k === 'j' ? 1 : -1) + vis.length) % vis.length];
    select(to, { focus: true, user: true });
    if (mode === 'tabs') archive.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  }
});

// Stack index: every tool named in a STACK line becomes clickable; picking one lights up
// every card that used it (and filters the archive to those files)
let lensTool = null;
function clearLens() {
  lensTool = null;
  $('main')?.classList.remove('lensed');
  toolsOf.forEach((set, card) => card.classList.remove('match'));
  $$('[data-tool]').forEach(b => b.setAttribute('aria-pressed', 'false'));
  const out = $('.lens-out');
  if (out) { out.hidden = true; out.replaceChildren(); }
  if ($('#archive-status')) $('#archive-status').textContent = '';
}
function lens(name) {
  lensTool = name === lensTool ? null : name;
  const main = $('main');
  main?.classList.toggle('lensed', !!lensTool);
  let n = 0;
  toolsOf.forEach((set, card) => { const on = !!lensTool && set.has(lensTool); card.classList.toggle('match', on); n += on; });
  $$('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === lensTool));
  if (archive && files.length) {
    filter = lensTool && files.some(f => toolsOf.get(f)?.has(lensTool)) ? `tool:${lensTool}` : 'all';
    $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x.dataset.filter === filter));
    applyFilter();
  }
  const out = $('.lens-out');
  if (!lensTool) { clearLens(); return; }
  const msg = `${lensTool}: used in ${n} ${n === 1 ? 'file' : 'files'}`;
  if ($('#archive-status')) $('#archive-status').textContent = msg;
  // Results right under the index, so matches elsewhere on the page are one click away
  if (out) {
    const label = Object.assign(document.createElement('b'), { textContent: `${lensTool} · ${n}` });
    const links = [...toolsOf].filter(([, set]) => set.has(lensTool)).map(([card]) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'tlink', textContent: $('h3', card).textContent });
      b.addEventListener('click', () => {
        if (card.classList.contains('file')) return dispatchEvent(new CustomEvent('archive:open', { detail: card.id }));
        card.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'center' });
        const h = $('h3', card);
        h.tabIndex = -1;
        h.focus({ preventScroll: true });
      });
      return b;
    });
    const clear = Object.assign(document.createElement('button'), { type: 'button', className: 'clear', textContent: 'Clear ×' });
    clear.addEventListener('click', () => { clearLens(); filter = 'all'; applyFilter(); $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x.dataset.filter === 'all')); });
    out.replaceChildren(label, ...links, clear);
    out.hidden = false;
  }
}
addEventListener('keydown', e => {
  if (e.key === 'Escape' && lensTool && !document.querySelector('dialog[open]')) {
    clearLens();
    filter = 'all';
    $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x.dataset.filter === 'all'));
    applyFilter();
  }
});
const index = $('.stack-index');
if (index) {
  const count = new Map();
  $$('.spec').forEach(dl => {
    const card = dl.closest('.dossier, .order, .file'), dd = $('dd', dl);
    if (!card || !dd) return;
    const names = dd.textContent.split('/').map(t => t.trim()).filter(Boolean);
    toolsOf.set(card, new Set([...(toolsOf.get(card) ?? []), ...names]));
    dd.replaceChildren(...names.flatMap((name, i) => {
      const b = Object.assign(document.createElement('button'), { type: 'button', textContent: name });
      b.dataset.tool = name;
      b.setAttribute('aria-pressed', 'false');
      return i ? [' / ', b] : [b];
    }));
    names.forEach(name => count.set(name, (count.get(name) ?? 0) + 1));
  });
  const top = [...count].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14);
  $('.stack-list', index).append(...top.map(([name, c]) => {
    const b = Object.assign(document.createElement('button'), { type: 'button' });
    b.dataset.tool = name;
    b.setAttribute('aria-pressed', 'false');
    b.append(name, Object.assign(document.createElement('sup'), { textContent: c }));
    return b;
  }));
  index.hidden = false;
  document.addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) lens(b.dataset.tool); });
}

// Contact: Manvith's local time in Boston
const clock = $('.clock');
if (clock) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' });
  const tickClock = () => (clock.textContent = `BOS ${fmt.format(new Date())}`);
  tickClock();
  setInterval(tickClock, 30000);
}

// Load the heavier visuals only where they make sense
if (!forced && $('.field')?.getContext) import('./field.js').catch(err => console.warn(err));
if ($('.drill-canvas')) import('./drill.js').catch(err => console.warn(err));
if (!forced && fine.matches) import('./cursor.js').then(m => { cursorApi = m; m.init(); }).catch(err => console.warn(err));

console.info('%cHello, fellow engineer.%c Source: github.com/Manvith-d/portfolio', 'font:600 13px system-ui;color:#ff5c5c', 'font:13px system-ui');
