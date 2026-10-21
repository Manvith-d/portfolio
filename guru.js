// Guru: a scripted guide to Manvith's work, in a comms drawer. No AI model and no cost:
// questions are matched against TOPICS (loaded on first use), and follow-ups such as
// "how is it useful?" apply to the last project discussed.
// ponytail: keyword scoring; swap in embeddings if visitors' questions outgrow it.
const ROOT = new URL('./', import.meta.url);
let TOPICS = [], byId = {}, loading;
const load = () => (loading ??= import('./guru-data.js').then(m => {
  TOPICS = m.TOPICS;
  byId = Object.fromEntries(TOPICS.map(t => [t.id, t]));
  selfCheck();
}));

const STOP = new Set('a an the is are was were of to in on for and or me tell about what whats what’s which how does do did his he him can you your please show give more info i it its this that with they them manvith dalli reddy s has have be'.split(' '));
const words = s => (s.toLowerCase().match(/[a-z0-9+#-]+/g) || []).filter(w => !STOP.has(w));
const near = (w, k) => k === w || (w.length > 3 && k.length > 3 && (k.startsWith(w) || w.startsWith(k)));
const keyCache = new Map();
const keysOf = t => keyCache.get(t) ?? keyCache.set(t, words(`${t.keys} ${t.head ?? ''} ${t.q}`)).get(t);

export function match(q) {
  const qs = words(q);
  let best = null, top = 0;
  for (const t of TOPICS) {
    const score = qs.filter(w => keysOf(t).some(k => near(w, k))).length;
    if (score > top) { top = score; best = t; }
  }
  return best;
}

// Follow-up intents, answered from the matching field of a topic
const INTENTS = [
  ['why', /\b(useful|why|impact|matter|matters|benefit|benefits|purpose|problem|value|solve|solves|point|important|help|helps)\b/],
  ['team', /\b(team|teammates?|who (built|made|worked)|built with|collaborat\w*|partners?)\b/],
  ['links', /\b(code|github|repo|repository|source|link|links|demo|see it)\b/],
  ['stack', /\b(stack|tech|technolog\w*|tools?|built (with|in|using)|languages?|framework)\b/],
];
const PRONOUN = /\b(it|its|this|that|they|them|the project)\b/;

// Returns { topic, intent } for a question, using the last project for vague follow-ups.
export function resolve(q, last) {
  const text = q.toLowerCase();
  const intent = INTENTS.find(([, re]) => re.test(text))?.[0];
  const usable = t => t && intent && t[intent];
  if (last && PRONOUN.test(text) && usable(last)) return { topic: last, intent };
  const topic = match(q);
  if (topic) return { topic, intent: usable(topic) ? intent : null };
  if (usable(last)) return { topic: last, intent };
  return null;
}

// Links in answers are written relative to the site root; resolve them for post pages too.
const href = h => (/^(https?:|mailto:)/.test(h) ? h : new URL(h, ROOT).href);
const linkList = links => `<p class="g-links">${links.map(([label, h]) =>
  `<a href="${href(h)}"${/^https?:/.test(h) ? ' target="_blank" rel="noopener"' : ''}>${label} ↗</a>`).join('<span aria-hidden="true">·</span>')}</p>`;
const short = t => t.head.split(',')[0];
const fixLinks = html => html.replace(/href="(?!https?:|mailto:)([^"]+)"/g, (_, h) => `href="${href(h)}"`);

function render(t, intent) {
  if (intent === 'why') return `<p class="g-head"><strong>Why ${short(t)} matters</strong></p><p>${t.why}</p>`;
  if (intent === 'team') return `<p class="g-head"><strong>${short(t)}: the team</strong></p><p>${t.team}</p>`;
  if (intent === 'stack') return `<p class="g-head"><strong>${short(t)}: the stack</strong></p><p>${t.stack}</p>`;
  if (intent === 'links') return `<p class="g-head"><strong>${short(t)}: links</strong></p>${linkList(t.links)}`;
  return fixLinks(`<p class="g-head"><strong>${t.head}</strong>${t.meta ? ` <span>(${t.meta})</span>` : ''}</p>`
    + (t.stack ? `<p class="g-stack"><span>STACK</span>${t.stack}</p>` : '')
    + (t.text ?? '')
    + (t.points ? `<ul>${t.points.map(p => `<li>${p}</li>`).join('')}</ul>` : ''))
    + (t.links ? linkList(t.links) : '');
}

// Where each topic lives on the homepage, for "Go to section →"
const JUMP = {
  greek: '#greek-shield', monitor: '#greek-shield', abdiffuser: '#abdiffuser',
  citizens: '#citizens', cmod: '#citizens', pbqc: '#citizens', cleanup: '#citizens', screenshot: '#citizens', badge: '#citizens',
  ontobridge: '#p-ontobridge', hedging: '#p-deep-hedging', gpu: '#p-gpu-inference-benchmark', translens: '#p-translens', community: '#p-community-insights',
  crop: '#p-crop-recommendation', cancer: '#p-cancer-genes', mindconnect: '#p-mindconnect', sports: '#p-sports-injury',
  plate: '#p-number-plate', drone: '#p-drone-delivery', projects: '#projects', writing: '#writing',
  experience: '#about', education: '#about', certs: '#about', contact: '#contact',
};
function jump(id) {
  const sel = JUMP[id];
  dialog.close();
  const node = document.querySelector(sel);
  if (!node) return (location.href = new URL(sel, ROOT).href);
  // Wait for the dialog's focus restoration, which would otherwise cancel the smooth scroll
  setTimeout(() => {
    if (sel.startsWith('#p-')) return dispatchEvent(new CustomEvent('archive:open', { detail: sel.slice(1) }));
    if (window.siteScroll) window.siteScroll(node);
    else node.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    const h = node.querySelector('h2, h3') ?? node;
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }, 60);
}

// UI
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SIGNAL = '<svg class="signal" viewBox="0 0 16 16" aria-hidden="true"><path class="bk2" d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4" fill="none" stroke="currentColor" stroke-width="1.5"/><path class="core" d="M8 4.5 11.5 8 8 11.5 4.5 8z" fill="currentColor"/></svg>';
const dialog = document.body.appendChild(document.createElement('dialog'));
dialog.className = 'guru';
dialog.setAttribute('aria-label', 'Guru, a scripted guide to Manvith’s work');
dialog.innerHTML = `<div class="guru-head">${SIGNAL}<div><strong>Guru</strong><small>A scripted guide to Manvith’s work · no AI, no tracking</small></div>
<button class="guru-icon guru-reset" type="button" aria-label="Start over" title="Start over">↺</button><button class="guru-icon guru-close" type="button" aria-label="Close Guru" title="Close">×</button></div>
<div class="guru-log" aria-live="polite"></div>
<form class="guru-form"><input name="q" type="text" autocomplete="off" placeholder="Ask about a project, skill or role…" aria-label="Your question" maxlength="200"><button class="btn btn-primary" type="submit">Ask</button></form>`;
const log = dialog.querySelector('.guru-log');
const input = dialog.querySelector('input');
let last = null, opened = 0;

const stamp = () => {
  const s = Math.floor((performance.now() - opened) / 1000);
  return `<span class="ts" aria-hidden="true">T+${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}</span>`;
};
function add(cls, html) {
  const el = log.appendChild(document.createElement('div'));
  el.className = 'msg ' + cls;
  if (cls === 'me') el.textContent = html; else el.innerHTML = (cls === 'bot' ? stamp() : '') + html;
  if (cls === 'bot') el.querySelectorAll(':scope > *, li').forEach((n, i) => n.style.setProperty('--i', i));
  log.scrollTop = log.scrollHeight;
  return el;
}
function replies(items, jumpTo) {
  const box = log.appendChild(document.createElement('div'));
  box.className = 'replies';
  if (jumpTo && JUMP[jumpTo]) {
    const b = box.appendChild(Object.assign(document.createElement('button'), { type: 'button', className: 'jump', textContent: 'Go to section' }));
    b.onclick = () => jump(jumpTo);
  }
  for (const [label, hit] of items) {
    const b = box.appendChild(Object.assign(document.createElement('button'), { type: 'button', textContent: label }));
    b.onclick = () => ask(label, hit);
  }
  log.scrollTop = log.scrollHeight;
  if (refocus) { refocus = false; box.querySelector('button')?.focus({ preventScroll: true }); }
}
let refocus = false;
const questions = ids => ids.filter(id => byId[id]).map(id => [byId[id].q, { topic: byId[id], intent: null }]);
const STARTERS = ['hire', 'greek', 'data', 'citizens'];
const FALLBACK = `<p>No record of that in my files. I can brief you on Manvith’s projects, experience, skills, education, certifications or availability. For anything else, <a href="mailto:reddydalli.m@northeastern.edu">email him</a> and he’ll answer directly.</p>`;

function reply(hit) {
  if (document.activeElement?.closest?.('.replies')) refocus = true;
  log.querySelectorAll('.replies').forEach(c => c.remove());
  return new Promise(done => answer(hit, done));
}
function answer(hit, done) {
  const dots = add('typing', '<i></i><i></i><i></i>');
  dialog.classList.add('typing');
  setTimeout(() => {
    dots.remove();
    dialog.classList.remove('typing');
    done();
    if (!hit) { add('bot', FALLBACK); return replies(questions(STARTERS.slice(0, 3))); }
    const t = hit.topic;
    add('bot', render(t, hit.intent));
    if (t.why || t.team) last = t;
    // A project answer also offers its own follow-ups as one-click questions
    const follow = hit.intent ? [] : [
      t.why && [`How is ${short(t)} useful?`, { topic: t, intent: 'why' }],
      t.team && [`Who built ${short(t)}?`, { topic: t, intent: 'team' }],
    ].filter(Boolean);
    replies([...follow, ...questions(t.next)].slice(0, 4), t.id);
  }, still ? 0 : 320 + Math.random() * 280);
}
// Questions are answered in order; a fast second question waits for the first answer
let queue = Promise.resolve();
function ask(text, hit) {
  add('me', text);
  queue = queue.then(load).then(() => reply(hit ?? resolve(text, last)));
}
function greet() {
  log.replaceChildren();
  last = null;
  opened = performance.now();
  add('bot', '<p>Channel open. I’m Guru, a scripted guide to Manvith’s work. Pick a file below or type a question.</p>');
}
export async function open(topicId) {
  if (!dialog.open) dialog.showModal();
  // On touch screens, don't summon the keyboard over the suggested questions
  if (matchMedia('(pointer: fine)').matches) input.focus(); else dialog.querySelector('.guru-close').focus();
  const fresh = !log.children.length;
  if (fresh) greet();
  await load();
  const topic = byId[topicId];
  if (topic) ask(topic.q, { topic, intent: null });
  else if (fresh) replies(questions(STARTERS));
}

dialog.querySelector('form').addEventListener('submit', e => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) ask(q);
  input.value = '';
});
dialog.querySelector('.guru-close').onclick = () => dialog.close();
dialog.querySelector('.guru-reset').onclick = async () => { greet(); await load(); replies(questions(STARTERS)); input.focus(); };
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

// Entry points: any [data-guru] button (its value names a topic), "/" and Ctrl/⌘+K
document.querySelectorAll('[data-guru]').forEach(b => {
  b.hidden = false;
  b.addEventListener('click', () => open(b.dataset.guru));
});
addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (((e.key === '/' && !typing) || (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey))) && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    open();
  }
});
// Warm the data in idle time so the first answer is instant
(window.requestIdleCallback ?? (f => setTimeout(f, 2000)))(() => load());

// Self-check: follow-ups exist, and common phrasings land where expected.
function selfCheck() {
  for (const t of TOPICS) t.next.forEach(id => console.assert(byId[id], `guru: ${t.id} -> missing ${id}`));
  const greek = byId.greek;
  [['Why should we hire him?', null, 'hire', null], ['tell me about greek shield', null, 'greek', null],
   ['how is it useful', greek, 'greek', 'why'], ['who built it?', greek, 'greek', 'team'], ['what tech does it use', greek, 'greek', 'stack'],
   ['is he available for hire?', null, 'contact', null], ['antibody diffusion', null, 'abdiffuser', null], ['ocr', null, 'plate', null],
   ['what’s his data engineering experience?', null, 'data', null], ['what is the weather in boston', null, undefined, undefined]]
    .forEach(([q, prev, id, intent]) => {
      const r = resolve(q, prev);
      console.assert(r?.topic.id === id && (r?.intent ?? null) === (intent ?? null), `guru: "${q}" -> ${r?.topic.id}/${r?.intent}, expected ${id}/${intent}`);
    });
}
