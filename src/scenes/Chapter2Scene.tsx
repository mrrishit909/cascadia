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

    if (genRow) gsap.set(genRow, { opacity: 1 })
    if (demandRow) gsap.set(demandRow, { opacity: 0 })
    claimCamera('ch2', active, FULL_CAMERA)

    ScrollTrigger.create({
      id: 'ch2-scene-scrub',
      trigger: section,
      start: 'top top',
      end: 'bottom top',
      scrub: true,
      onUpdate: self => {
        claimCamera('ch2', active, lerpCamera(FULL_CAMERA, CH2_CAMERA, self.progress))
        if (genRow) gsap.set(genRow, { opacity: 1 - self.progress })
        if (demandRow) gsap.set(demandRow, { opacity: self.progress })
      },
    })
  }, [active])
  return null
}
