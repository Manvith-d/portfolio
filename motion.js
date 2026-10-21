// Motion layer built on GSAP (ScrollTrigger + SplitText) and Lenis.
// main.js loads this only when the libraries arrived and the visitor allows motion;
// without it the site keeps its CSS reveals and native scrolling.
import { P, onFrame } from './main.js';

const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fine = matchMedia('(pointer: fine) and (hover: hover)').matches;
gsap.registerPlugin(ScrollTrigger, SplitText);

// ---- Lenis smooth scroll, driven by GSAP's ticker so ScrollTrigger stays in sync --------
const headerOffset = () => -(document.querySelector('.bar')?.offsetHeight ?? 64) - 16;
const lenis = new Lenis({ lerp: 0.11, anchors: { offset: headerOffset() }, allowNestedScroll: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
// Dialogs scroll on their own; pause the page while one is open
$$('dialog').forEach(d => d.setAttribute('data-lenis-prevent', ''));
new MutationObserver(() => (document.querySelector('dialog[open]') ? lenis.stop() : lenis.start()))
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'], childList: true });
// Every in-page jump (Guru, archive, stack lens, J/K) goes through Lenis from now on
window.siteScroll = (el, { center = false } = {}) => {
  const off = center ? -(innerHeight - Math.min(el.offsetHeight, innerHeight)) / 2 : headerOffset();
  lenis.scrollTo(el, { offset: off });
};

// ---- SplitText: section headings rise word by word out of a mask ------------------------
$$('main h2').forEach(h2 => {
  h2.setAttribute('aria-label', h2.innerText.replace(/\s+/g, ' ').trim()); // keeps the space at <br>
  SplitText.create(h2, {
    type: 'lines,words', mask: 'lines', autoSplit: true, aria: 'hidden',
    onSplit: self => gsap.from(self.words, {
      yPercent: 110, duration: 0.9, ease: 'expo.out', stagger: 0.045,
      scrollTrigger: { trigger: h2, start: 'top 88%', once: true },
    }),
  });
});

// ---- Scroll-scrubbed depth --------------------------------------------------------------
// Greek Shield's six layers spread into an exploded view as the dossier passes through
const slabs = $$('#greek-shield .slab');
if (slabs.length) {
  gsap.to(slabs, {
    y: i => -i * 7, ease: 'none',
    scrollTrigger: { trigger: '#greek-shield', start: 'top 85%', end: 'center 35%', scrub: 0.6 },
  });
}
// Featured diagrams and archive diagrams lift into place
$$('.dossier .schematic, .mini').forEach(el => gsap.from(el, {
  scale: 0.97, opacity: 0.4, duration: 1, ease: 'expo.out',
  scrollTrigger: { trigger: el, start: 'top 92%', once: true },
}));

// ---- Variable proximity (after ReactBits): letters of the name thicken near the cursor ---
const name = $('.name');
if (name && fine) {
  name.setAttribute('aria-label', 'Manvith Reddy Dalli');
  $('.sheen', name)?.remove(); // the sheen duplicate can't follow changing letter widths
  const chars = [];
  for (const line of $$('.l1, .l2', name)) {
    line.setAttribute('aria-hidden', 'true');
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent) {
        if (ch === ' ') { frag.append(' '); continue; }
        const span = Object.assign(document.createElement('span'), { className: 'vp', textContent: ch });
        chars.push({ el: span, w: 600 });
        frag.append(span);
      }
      node.replaceWith(frag);
    }
  }
  onFrame(() => {
    const r = name.getBoundingClientRect();
    const near = P.active && P.y > r.top - 220 && P.y < r.bottom + 220 && P.x > r.left - 220 && P.x < r.right + 220;
    for (const c of chars) {
      let target = 580; // resting weight; peaks at 700 right under the cursor
      if (near) {
        const b = c.el.getBoundingClientRect();
        const d = Math.hypot(P.x - (b.left + b.width / 2), P.y - (b.top + b.height / 2));
        target = 580 + 120 * Math.max(0, 1 - d / 200) ** 1.5;
      }
      const w = c.w + (target - c.w) * 0.18;
      if (Math.abs(w - c.w) > 0.5) { c.w = w; c.el.style.fontVariationSettings = `"wght" ${w.toFixed(0)}, "opsz" 96`; }
    }
  });
}
