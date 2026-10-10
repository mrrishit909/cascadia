import { useRef, type ReactNode } from 'react'
import { useScene } from './useScene'

// ART_DIRECTION.md's motion sheet, "select effects" table: "Masked text reveal -- chapter titles
// only, 800ms, once per entry, replay on index navigation. Reduced motion: immediate text." One
// shared primitive used by every chapter's <h2> (FigIndex navigation and scroll both flow through
// the same `active` prop via useActiveChapter, so "replay on index navigation" falls out of the
// normal entry trigger -- no separate code path needed). A vertical clip-path wipe stands in for the
// mask: hidden (fully clipped) while not active, wipes open top-to-bottom on entry, instantly open
// under reduced motion.
export function ChapterTitle({ sceneId, active, children }: { sceneId: string; active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useScene(sceneId, ref, ({ gsap, reducedMotion }) => {
    const el = ref.current
    if (!el) return
    // Kill any still-running reveal tween FIRST: this chapter's own version of the stale-timeline bug
    // IntroSequence's review caught -- useGSAP does not revert a running tween just because `active`
    // flipped again before it finished (leaving within 800ms of entry, e.g. a fast FIG-index jump to
    // another chapter, let the old tween keep animating clip-path back toward 0% and silently
    // overwrite the hide this effect is about to set below).
    gsap.killTweensOf(el)
    // Reduced motion means "immediate text," full stop -- never clipped, active or not, so a user who
    // hasn't scrolled an inactive chapter's heading into view yet doesn't see it rendered as a blank
    // gap (the original ordering checked `!active` BEFORE `reducedMotion`, clipping every inactive
    // title regardless of motion preference).
    if (reducedMotion) { gsap.set(el, { clipPath: 'inset(0 0 0% 0)' }); return }
    if (!active) { gsap.set(el, { clipPath: 'inset(0 0 100% 0)' }); return }
    gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 0.8, ease: 'power2.out' })
  }, [active])
  return <h2 ref={ref}>{children}</h2>
}
