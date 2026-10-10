import { useScene } from './useScene'
import { claimCamera, FULL_CAMERA, lerpCamera } from './presentationCamera'

// ART_DIRECTION.md's per-chapter motion table, row 2: "Section enters, then scrub over the section.
// Scroll progress 0-1 drives the camera pan and the balance-rule morph (geometry only)." A real
// ScrollTrigger scrub (this project's first -- the intro deliberately avoided ScrollTrigger's own
// toggle/progress heuristics for its one-shot beats, see IntroSequence.tsx's history; a genuinely
// continuous scroll-bound pan is a different, legitimate use of the same plugin). `claimCamera`'s own
// ownership guard (presentationCamera.ts) makes this safe to leave mounted unconditionally: writes
// are silently dropped whenever `active!=='ch2'`, and App.tsx's `resetCameraToDefault` effect already
// restores FULL_CAMERA the instant the user leaves, so this scene never needs its own convergence
// branch the way IntroSequence does.
const CH2_CAMERA = { x: 60, y: 40, w: 760, h: 560 }

export function Chapter2Scene({ sectionRef, active }: { sectionRef: React.RefObject<HTMLElement | null>; active: string }) {
  useScene('ch2-scene', sectionRef, ({ gsap, ScrollTrigger, reducedMotion }) => {
    const section = sectionRef.current
    if (!section) return
    const genRow = section.querySelector('[data-testid="balance-gen"]')
    const demandRow = section.querySelector('[data-testid="balance-demand"]')

    if (reducedMotion) {
      // Table's own reduced-motion cell for chapter 2: "End state, both stacks shown" -- the one
      // chapter whose reduced-motion state is NOT simply "instant end frame" but a different
      // composition (both generation and demand visible together, since there is no scroll to
      // crossfade them against). Both rows are `position:absolute` over the SAME box for the
      // crossfade (see experience.css's .balance-rule-row) -- showing both at opacity 1 there would
      // overlap into illegible double-exposed text, caught via a real screenshot, so reduced motion
      // additionally un-stacks them back to normal flow instead of just setting both opaque.
      claimCamera('ch2', active, CH2_CAMERA)
      if (genRow) gsap.set(genRow, { opacity: 1, position: 'static' })
      if (demandRow) gsap.set(demandRow, { opacity: 1, position: 'static', marginTop: 4 })
      return
    }

    // Applies the scrub's visual state for a given progress value -- called both from onUpdate (every
    // real scroll tick) AND once immediately after creating the trigger below. Without the immediate
    // call, nothing reflects the CURRENT scroll position until the next scroll event fires: a user who
    // arrives already partway through the section (scrolling up from chapter 3, a keyboard PageUp that
    // flips `active` without a further scroll event) would see chapter 1's gen=1/demand=0 defaults
    // frozen until they scrolled again, then pop to the correct value -- found via a review of the real
    // user paths this scene needs to handle, not just the "scroll from the very top" path the original
    // version only ever exercised.
    const apply = (p: number) => {
      claimCamera('ch2', active, lerpCamera(FULL_CAMERA, CH2_CAMERA, p))
      if (genRow) gsap.set(genRow, { opacity: 1 - p })
      if (demandRow) gsap.set(demandRow, { opacity: p })
    }

    const st = ScrollTrigger.create({
      id: 'ch2-scene-scrub',
      trigger: section,
      start: 'top top',
      // Ends at 80%, not 'bottom top': useActiveChapter hands chapter 2 off to chapter 3 once chapter
      // 3 dominates the viewport's center band (its own IntersectionObserver, independent of this
      // trigger) -- which happens WHILE chapter 2's bottom is still approaching the viewport, well
      // before the section has fully scrolled past. Ending at 'bottom top' made progress=1
      // unreachable while chapter 2 was still the active chapter (confirmed directly: an e2e test
      // scrubbing toward progress=1 lost the chapter-2 camera claim partway through, every one after
      // was silently dropped by claimCamera's ownership guard). 80% leaves a real margin instead of
      // chasing the exact handoff pixel.
      end: '60% top',
      scrub: true,
      onUpdate: self => apply(self.progress),
    })
    apply(st.progress) // in case the trigger was created already partway through its own range
  }, [active])
  return null
}
