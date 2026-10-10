import { useEffect, useRef, useState } from 'react'

// UI-only navigation state, deliberately NOT in AppState (docs/planning/cascadia/CHAPTER_ARCHITECTURE.md
// section 5's open item: "the 'current chapter' detection mechanism isn't chosen yet -- likely a small
// piece of UI-only state... separate from the analytical AppState entirely"). IntersectionObserver, not
// scroll-position math: works identically for native scroll, keyboard (PageDown/Home/End), and the FIG
// index's anchor jumps, and needs no scroll-event throttling.
//
// `ids`: ordered chapter section ids, e.g. ['intro','ch1',...,'ch6']. Returns the id whose section has
// the largest intersection with a thin band near the viewport's vertical center -- not simply "any
// visibility", so a chapter is "active" only once it's genuinely the one in focus, not merely peeking in
// at the very top/bottom edge.
export function useActiveChapter(ids: string[]): string {
  const [active, setActive] = useState(ids[0])
  const ratios = useRef(new Map<string, number>())
  useEffect(() => {
    let io: IntersectionObserver | null = null
    let mo: MutationObserver | null = null
    const trySetup = (): boolean => {
      const els = ids.map(id => document.getElementById(id)).filter((e): e is HTMLElement => e !== null)
      if (els.length === 0) return false
      io = new IntersectionObserver(entries => {
        for (const e of entries) ratios.current.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0)
        let bestId = active, bestRatio = -1
        for (const id of ids) {
          const r = ratios.current.get(id) ?? 0
          if (r > bestRatio) { bestRatio = r; bestId = id }
        }
        if (bestRatio > 0) setActive(bestId)
      }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1], rootMargin: '-20% 0px -20% 0px' })
      els.forEach(el => io!.observe(el))
      return true
    }
    if (!trySetup()) {
      // Real bug, not a theoretical one: Scene renders a plain "Loading baseline" paragraph (no chapter
      // sections at all) while AppState's fetch is in flight, and this effect's dependency array never
      // changes once that fetch resolves and the real chapter markup mounts -- so without a retry path,
      // this effect runs exactly once, finds zero elements, bails out via the `if (els.length === 0)
      // return` guard, and NEVER runs again. The chapter index/stage would then stay permanently stuck
      // on its initial value in every real page load. A MutationObserver (unlike IntersectionObserver,
      // genuinely supported in jsdom too) retries setup once the chapter sections actually appear, then
      // disconnects itself.
      mo = new MutationObserver(() => { if (trySetup()) mo?.disconnect() })
      mo.observe(document.body, { childList: true, subtree: true })
    }
    return () => { io?.disconnect(); mo?.disconnect() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])
  return active
}
