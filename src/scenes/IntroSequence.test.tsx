import { render } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { IntroSequence } from './IntroSequence'
import { ScrollTrigger } from './gsapSetup'
import { setIntroFaultActive, useIntroFaultActive } from './introFixtureState'
import { setIntroChromeVisible, useIntroChromeVisible } from './introChromeState'
import { setIntroSkipped } from './introSkipState'
import type { Case30 } from '../engine/types'

// Two buses, one line between them -- bus 0 is the hero (BFS start). Enough for bfsFromHero to do real
// work (one hop) without needing the full case30 fixture; NetworkView's own tests cover real rendering.
const NETWORK: Case30 = {
  sn_mva: 100,
  buses: [{ idx: 0, x: 0, y: 0 } as never, { idx: 1, x: 1, y: 1 } as never],
  lines: [{ idx: 0, from_bus: 0, to_bus: 1, r_ohm: 0, x_ohm: 0, max_i_ka: 1, x_pu: 0.1, rating_mw: 100 }],
  gens: [],
  loads: [],
}

function Harness({ stageRef, introRef, active = 'intro' }: { stageRef: React.RefObject<HTMLDivElement | null>; introRef: React.RefObject<HTMLElement | null>; active?: string }) {
  return (
    <div>
      <div ref={stageRef}>
        <g data-testid="bus" data-bus="0" />
        <g data-testid="bus" data-bus="1" />
        <g data-testid="line" data-line="0">
          <line data-testid="line-core" />
        </g>
      </div>
      <section ref={introRef} />
      <IntroSequence stageRef={stageRef} introRef={introRef} active={active} network={NETWORK} flows={{ '0': 5 }} />
    </div>
  )
}

beforeEach(() => {
  setIntroFaultActive(false)
  setIntroChromeVisible(false)
  setIntroSkipped(false)
})

afterEach(() => {
  ScrollTrigger.getAll().forEach(st => st.kill())
})

describe('IntroSequence beat 1 (0-3s blackout)', () => {
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
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    const { container, rerender } = render(<Harness stageRef={stageRef} introRef={introRef} active="intro" />)
    const other = container.querySelector('[data-bus="1"]') as HTMLElement
    expect(other.style.opacity).toBe('0')
    rerender(<Harness stageRef={stageRef} introRef={introRef} active="ch6" />) // simulates an instant jump straight to the lab
    expect(other.style.opacity).toBe('')
  })

  it('REGRESSION: re-applies the blackout when returning to intro after leaving', () => {
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

  it('leaving the intro marks chrome visible and clears the presentation fault flag', () => {
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    let fault = true, chrome = false
    const Probe = () => { fault = useIntroFaultActive(); chrome = useIntroChromeVisible(); return null }
    setIntroFaultActive(true)
    const { rerender } = render(<><Harness stageRef={stageRef} introRef={introRef} active="intro" /><Probe /></>)
    rerender(<><Harness stageRef={stageRef} introRef={introRef} active="ch2" /><Probe /></>)
    expect(fault).toBe(false)
    expect(chrome).toBe(true)
  })
})

describe('IntroSequence reduced motion / skip (identical end states)', () => {
  it('reduced motion loads the final frame directly: every bus/line visible, fault active, chrome visible', () => {
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    const origMatchMedia = window.matchMedia
    window.matchMedia = (query: string) => ({ ...origMatchMedia(query), matches: query.includes('prefers-reduced-motion') })
    let fault = false, chrome = false
    const Probe = () => { fault = useIntroFaultActive(); chrome = useIntroChromeVisible(); return null }
    try {
      const { container } = render(<><Harness stageRef={stageRef} introRef={introRef} /><Probe /></>)
      const other = container.querySelector('[data-bus="1"]') as HTMLElement
      expect(other.style.opacity).toBe('1')
      expect(fault).toBe(true)
      expect(chrome).toBe(true)
    } finally {
      window.matchMedia = origMatchMedia
    }
  })

  it('skip intro resolves to the same instant end state as reduced motion', () => {
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    setIntroSkipped(true)
    let fault = false, chrome = false
    const Probe = () => { fault = useIntroFaultActive(); chrome = useIntroChromeVisible(); return null }
    const { container } = render(<><Harness stageRef={stageRef} introRef={introRef} /><Probe /></>)
    const other = container.querySelector('[data-bus="1"]') as HTMLElement
    expect(other.style.opacity).toBe('1')
    expect(fault).toBe(true)
    expect(chrome).toBe(true)
  })

  it('REGRESSION: a stale full-sequence timeline does not keep running after Skip is clicked mid-playback', () => {
    // Reproduces the bug an independent review caught: without killing the prior timeline, Skip's
    // instant end-state write would be overwritten moments later by the still-running beat 2/3 steps
    // of the ORIGINAL (non-skipped) timeline re-dashing the line core.
    const stageRef = createRef<HTMLDivElement>()
    const introRef = createRef<HTMLElement>()
    const { container, rerender } = render(<Harness stageRef={stageRef} introRef={introRef} active="intro" />)
    // Mid-playback (beat 1 still active): user clicks Skip.
    setIntroSkipped(true)
    rerender(<Harness stageRef={stageRef} introRef={introRef} active="intro" />)
    const core = container.querySelector('[data-testid="line-core"]') as SVGLineElement
    const other = container.querySelector('[data-bus="1"]') as HTMLElement
    expect(other.style.opacity).toBe('1')
    expect(core.style.strokeDasharray).toBe('')
    expect(core.style.strokeDashoffset).toBe('')
  })
})
