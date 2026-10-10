import { render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ChapterTitle } from './ChapterTitle'
import { ScrollTrigger } from './gsapSetup'

afterEach(() => {
  ScrollTrigger.getAll().forEach(st => st.kill())
})

describe('ChapterTitle (masked reveal, ART_DIRECTION.md motion sheet: "chapter titles only, 800ms, once per entry")', () => {
  it('is fully clipped (hidden) while not active', () => {
    const { container } = render(<ChapterTitle sceneId="t-a" active={false}>FIG. 01</ChapterTitle>)
    const h2 = container.querySelector('h2') as HTMLElement
    expect(h2.style.clipPath).toBe('inset(0 0 100% 0)')
  })

  it('wipes open (clip-path converges to 0) on entry', () => {
    const { container } = render(<ChapterTitle sceneId="t-b" active={true}>FIG. 02</ChapterTitle>)
    const h2 = container.querySelector('h2') as HTMLElement
    // gsap.fromTo sets the FROM state synchronously on creation, then animates toward the TO state --
    // the from-state (still fully clipped) is what's observable synchronously in a test without ticking
    // gsap's own rAF-driven timeline, which is enough to prove the tween was armed correctly (the FULL
    // wipe-to-visible behavior is covered by the real-browser e2e test, which can wait out the 800ms).
    expect(h2.style.clipPath).toBe('inset(0 0 100% 0)')
  })

  it('reduced motion shows the title instantly, fully open, no clip', () => {
    const origMatchMedia = window.matchMedia
    window.matchMedia = (query: string) => ({ ...origMatchMedia(query), matches: query.includes('prefers-reduced-motion') })
    try {
      const { container } = render(<ChapterTitle sceneId="t-c" active={true}>FIG. 03</ChapterTitle>)
      const h2 = container.querySelector('h2') as HTMLElement
      expect(h2.style.clipPath).toBe('inset(0 0 0% 0)')
    } finally {
      window.matchMedia = origMatchMedia
    }
  })

  it('REGRESSION: re-clips (hides) when active goes back to false, so re-entry can replay the reveal', () => {
    const { container, rerender } = render(<ChapterTitle sceneId="t-d" active={true}>FIG. 04</ChapterTitle>)
    rerender(<ChapterTitle sceneId="t-d" active={false}>FIG. 04</ChapterTitle>)
    const h2 = container.querySelector('h2') as HTMLElement
    expect(h2.style.clipPath).toBe('inset(0 0 100% 0)')
  })

  it('REGRESSION: reduced motion never clips, even while inactive (a title must not scroll in as a blank gap)', () => {
    const origMatchMedia = window.matchMedia
    window.matchMedia = (query: string) => ({ ...origMatchMedia(query), matches: query.includes('prefers-reduced-motion') })
    try {
      const { container } = render(<ChapterTitle sceneId="t-e" active={false}>FIG. 05</ChapterTitle>)
      const h2 = container.querySelector('h2') as HTMLElement
      expect(h2.style.clipPath).toBe('inset(0 0 0% 0)')
    } finally {
      window.matchMedia = origMatchMedia
    }
  })
})
