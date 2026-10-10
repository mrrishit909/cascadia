import { render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { IntroBeat1 } from './IntroBeat1'
import { ScrollTrigger } from './gsapSetup'
import { claimCamera, FULL_CAMERA, resetCameraToDefault, usePresentationCamera } from './presentationCamera'

// Minimal real DOM: a stage with two buses (the hero, bus 0, and one other) and the intro section
// IntroBeat1 needs a ref to. Not the full NetworkView -- this tests THIS scene's own behavior
// (blackout state, reduced motion, convergence on chapter change), not NetworkView's own rendering
// (dedicated tests) or the shared GSAP lifecycle infrastructure (src/scenes/useScene.test.tsx).
function Harness({ stageRef, introRef, active = 'intro' }: { stageRef: React.RefObject<HTMLDivElement | null>; introRef: React.RefObject<HTMLElement | null>; active?: string }) {
  return (
    <div>
      <div ref={stageRef}>
        <g data-testid="bus" data-bus="0" />
        <g data-testid="bus" data-bus="1" />
        <g data-testid="line" data-line="0" />
      </div>
      <section ref={introRef} />
      <IntroBeat1 stageRef={stageRef} introRef={introRef} active={active} />
    </div>
  )
}

afterEach(() => {
  ScrollTrigger.getAll().forEach(st => st.kill())
})

describe('IntroBeat1', () => {
  it('sets the hero bus visible and every other bus/line hidden while active=intro (not reduced motion)', () => {
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    const { container } = render(<Harness stageRef={stageRef} introRef={introRef} />)
    const hero = container.querySelector('[data-bus="0"]') as HTMLElement
    const other = container.querySelector('[data-bus="1"]') as HTMLElement
    const line = container.querySelector('[data-testid="line"]') as HTMLElement
    expect(hero.style.opacity).toBe('1')
    expect(other.style.opacity).toBe('0')
    expect(line.style.opacity).toBe('0')
  })

  it('REGRESSION: force-clears the blackout once `active` leaves intro, even an instant multi-chapter jump', () => {
    // Reproduces the real bug an e2e test caught: a programmatic/instant jump straight from the intro
    // to a later chapter (no real scroll "velocity" for a ScrollTrigger-based approach to detect) used
    // to leave every non-hero bus/line permanently stuck at the blackout beat's opacity 0, because the
    // ORIGINAL design relied on a ScrollTrigger reverse-replay that couldn't be made to converge
    // reliably for an instant jump. This test doesn't touch scroll position at all -- it drives the
    // SAME `active`-change path a real chapter transition takes (useActiveChapter), independent of
    // ScrollTrigger timing, which is the actual fix.
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    const { container, rerender } = render(<Harness stageRef={stageRef} introRef={introRef} active="intro" />)
    const other = container.querySelector('[data-bus="1"]') as HTMLElement
    expect(other.style.opacity).toBe('0')
    rerender(<Harness stageRef={stageRef} introRef={introRef} active="ch6" />) // simulates an instant jump straight to the lab
    expect(other.style.opacity).toBe('')
  })

  it('REGRESSION: re-applies the blackout when returning to intro after leaving', () => {
    // The reverse direction of the above: scroll away, then scroll back. Must re-establish beat 1's
    // state exactly, not some stale intermediate frame.
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    const { container, rerender } = render(<Harness stageRef={stageRef} introRef={introRef} active="intro" />)
    rerender(<Harness stageRef={stageRef} introRef={introRef} active="ch2" />)
    const other = container.querySelector('[data-bus="1"]') as HTMLElement
    expect(other.style.opacity).toBe('')
    rerender(<Harness stageRef={stageRef} introRef={introRef} active="intro" />)
    const hero = container.querySelector('[data-bus="0"]') as HTMLElement
    expect(hero.style.opacity).toBe('1')
    expect(other.style.opacity).toBe('0')
  })

  it('reduced motion loads the final frame directly: every bus/line visible, no blackout at all', () => {
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    const origMatchMedia = window.matchMedia
    window.matchMedia = (query: string) => ({ ...origMatchMedia(query), matches: query.includes('prefers-reduced-motion') })
    try {
      const { container } = render(<Harness stageRef={stageRef} introRef={introRef} />)
      const other = container.querySelector('[data-bus="1"]') as HTMLElement
      expect(other.style.opacity).toBe('1')
    } finally {
      window.matchMedia = origMatchMedia
    }
  })
})

describe('presentationCamera (centralized ownership, cinematic-motion directive phase 3)', () => {
  it('a write from a non-active scene is dropped, not applied', () => {
    resetCameraToDefault('ch1')
    const target = { x: 10, y: 10, w: 100, h: 100 }
    claimCamera('ch2', 'ch1', target) // ch2 tries to write while ch1 is active -- must be ignored
    let current = FULL_CAMERA
    const Probe = () => { current = usePresentationCamera(); return null }
    render(<Probe />)
    expect(current).toEqual(FULL_CAMERA)
  })

  it('a write from the currently active scene is applied', () => {
    resetCameraToDefault('ch2')
    const target = { x: 10, y: 10, w: 100, h: 100 }
    claimCamera('ch2', 'ch2', target)
    let current = FULL_CAMERA
    const Probe = () => { current = usePresentationCamera(); return null }
    render(<Probe />)
    expect(current).toEqual(target)
  })

  it('resetCameraToDefault restores FULL_CAMERA regardless of what the previous chapter left behind', () => {
    claimCamera('ch2', 'ch2', { x: 10, y: 10, w: 100, h: 100 })
    resetCameraToDefault('ch3')
    let current = { x: -1, y: -1, w: -1, h: -1 }
    const Probe = () => { current = usePresentationCamera(); return null }
    render(<Probe />)
    expect(current).toEqual(FULL_CAMERA)
  })
})
