// Motion layer: scroll reveals, count-ups, cursor spotlight, scroll progress.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.add('js');

// Scroll progress bar + header state
const bar = document.body.appendChild(Object.assign(document.createElement('div'), { className: 'progress' }));
const header = document.querySelector('header');
addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max ? scrollY / max : 0})`;
  header.classList.toggle('scrolled', scrollY > 10);
}, { passive: true });

// Cursor spotlight (page) + per-card glow
const cards = '.feature, .citizens-card, .badge-card, .project';
addEventListener('pointermove', e => {
  document.body.style.setProperty('--mx', e.clientX + 'px');
  document.body.style.setProperty('--my', e.clientY + 'px');
  const card = e.target.closest(cards);
  if (card) {
    const r = card.getBoundingClientRect();
    card.style.setProperty('--cx', e.clientX - r.left + 'px');
    card.style.setProperty('--cy', e.clientY - r.top + 'px');
  }
}, { passive: true });

// Count up any number that leads its text ("1,000+", "309 HOURS / YEAR")
function countUp(el) {
  const m = el.textContent.match(/^([\d,]+)(.*)$/s);
  if (!m || still) return;
  const end = +m[1].replace(/,/g, ''), t0 = performance.now(), dur = 1400;
  const tick = now => {
    const p = Math.min((now - t0) / dur, 1), v = Math.round(end * (1 - (1 - p) ** 3));
    el.textContent = v.toLocaleString('en-US') + m[2];
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Reveal on scroll, staggered by position among siblings
const targets = document.querySelectorAll(
  '.hero > div > *, .hero-side > *, .strip, .section-head, .citizens-impact > *, .citizens-card, .feature, .project, .about > *, .contact, .impact-number, .citizens-card .meta'
);
const io = new IntersectionObserver(entries => entries.forEach(({ isIntersecting, target }) => {
  if (!isIntersecting) return;
  target.classList.add('in');
  if (/^\d/.test(target.textContent.trim()) && target.matches('.impact-number, .meta')) countUp(target);
  io.unobserve(target);
}), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
targets.forEach(el => {
  if (!el.matches('.impact-number, .citizens-card .meta')) {
    el.classList.add('reveal');
    el.style.setProperty('--d', [...el.parentElement.children].indexOf(el) % 6);
  }
  io.observe(el);
});
