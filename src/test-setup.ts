import "@testing-library/jest-dom/vitest";

// jsdom has no `window.matchMedia` at all -- GSAP's ScrollTrigger plugin calls it unconditionally at
// registration time (src/scenes/gsapSetup.ts, module load), so without this polyfill every test file
// that imports anything from src/scenes/ (transitively, via App.tsx) throws "matchMedia is not a
// function" before a single test in that file can run. `matches: false` is the correct default for
// jsdom tests: src/scenes/useScene.ts reads `prefers-reduced-motion` through this same API, and the
// non-reduced-motion code path is what exercises the actual GSAP timelines these tests need to cover.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
}

// jsdom has no real layout/intersection geometry, so `src/scenes/useActiveChapter.ts`'s real
// IntersectionObserver either doesn't exist in jsdom or never fires a meaningful callback -- without
// this mock, `activeChapter` stays stuck at its initial value ('intro') in every component test, so the
// persistent stage would always show the baseline story regardless of what a test's control actions
// produce (a real behavior difference from the browser, where scrolling genuinely changes which chapter
// is active). This mock makes the chapter-activation mechanism itself controllable from test code via
// `activateChapter(id)`, rather than leaving every chapter-aware component test silently wrong.
// Deliberately NOT `implements IntersectionObserver` -- the real interface grew fields (e.g.
// `scrollMargin`) this mock has no use for; a structural/partial shape is enough for a test double,
// cast to the real type only where consumed (useActiveChapter.ts calls `new IntersectionObserver(...)`
// against this constructor, and `activateChapter` below feeds it a minimal entry shape).
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  observed: Element[] = []
  constructor(cb: IntersectionObserverCallback) { this.callback = cb; MockIntersectionObserver.instances.push(this) }
  observe(el: Element) { this.observed.push(el) }
  unobserve(el: Element) { this.observed = this.observed.filter(e => e !== el) }
  disconnect() { this.observed = []; MockIntersectionObserver.instances = MockIntersectionObserver.instances.filter(i => i !== this) }
  takeRecords(): IntersectionObserverEntry[] { return [] }
}
// @ts-expect-error -- test-only polyfill, not a full IntersectionObserver implementation
globalThis.IntersectionObserver = MockIntersectionObserver

// Simulates the chapter with this `id` becoming the active one (the real browser's IntersectionObserver
// would report this once its <section> scrolls into the viewport's focus band). Finds whichever mock
// observer instance is watching that element (useActiveChapter's own effect) and fires a real-shaped
// callback for it; every other observed element implicitly reports ratio 0 by simply not being included,
// matching useActiveChapter's own "missing from this round's entries keeps its last known ratio" logic
// closely enough for test purposes (tests call this once per chapter they care about, not simulating a
// full scroll sequence).
export function activateChapter(id: string) {
  const el = document.getElementById(id)
  if (!el) throw new Error(`activateChapter: no element with id="${id}" in the DOM`)
  for (const inst of MockIntersectionObserver.instances) {
    if (inst.observed.includes(el)) {
      const entry = { target: el, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry
      inst.callback([entry], inst as unknown as IntersectionObserver)
    }
  }
}
