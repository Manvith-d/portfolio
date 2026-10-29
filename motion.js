// Motion layer built on GSAP (ScrollTrigger + SplitText) and Lenis.
// main.js loads this only when the libraries arrived and the visitor allows motion;
// without it the site keeps its CSS reveals and native scrolling.
const { gsap, ScrollTrigger, SplitText, Lenis } = window;
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
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
