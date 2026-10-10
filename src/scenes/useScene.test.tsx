import { act, render } from '@testing-library/react'
import { createRef, StrictMode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ScrollTrigger } from './gsapSetup'
import { useScene } from './useScene'

// Shared GSAP lifecycle layer, tested directly against a minimal scene that creates a real
// ScrollTrigger (cinematic-motion directive phase 6's acceptance gate covers this infrastructure, which
// every future scroll-scrubbed chapter scene -- not just IntroBeat1, which no longer uses ScrollTrigger
// itself -- depends on for correctness).
function TriggerScene({ elRef }: { elRef: React.RefObject<HTMLDivElement | null> }) {
  useScene('test-scene', elRef, ({ gsap }) => {
    if (!elRef.current) return
    gsap.timeline({ scrollTrigger: { id: 'test-scene-1', trigger: elRef.current } })
  })
  return null
}

// useScene's own ref-timing safety net (see its header comment: a child/sibling scene's layout effect
// can run before a DOM node elsewhere in the same commit has its ref attached, confirmed directly under
// this project's React/testing-library versions) retries via requestAnimationFrame when the scope ref
// isn't ready yet. Tests that depend on setup() having actually run wait one real animation frame for
// that retry to resolve, exactly like a real browser would on the very next paint.
const waitFrame = () => act(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))

afterEach(() => {
  ScrollTrigger.getAll().forEach(st => st.kill())
})

describe('useScene (shared GSAP lifecycle)', () => {
  it('creates exactly one ScrollTrigger under a single mount', async () => {
    const elRef = createRef<HTMLDivElement>()
    render(<div ref={elRef}><TriggerScene elRef={elRef} /></div>)
    await waitFrame()
    expect(ScrollTrigger.getAll().filter(st => st.vars.id === 'test-scene-1').length).toBe(1)
  })

  it('REGRESSION: does not duplicate its ScrollTrigger under React StrictMode (mount -> cleanup -> mount)', async () => {
    // Confirmed necessary by direct reproduction, not assumed: under this project's installed versions
    // (React 19.3.0, @gsap/react 2.1.2), @gsap/react's own StrictMode handling alone left a duplicate
    // ScrollTrigger behind in an isolated repro. useScene doesn't depend on that working correctly --
    // every setup() call kills any existing ScrollTrigger tagged with this scene's id first, so a
    // duplicate invocation converges to exactly one trigger instead of accumulating.
    const elRef = createRef<HTMLDivElement>()
    render(
      <StrictMode>
        <div ref={elRef}><TriggerScene elRef={elRef} /></div>
      </StrictMode>,
    )
    await waitFrame()
    expect(ScrollTrigger.getAll().filter(st => st.vars.id === 'test-scene-1').length).toBe(1)
  })

  it('REGRESSION: cleans up its ScrollTrigger on unmount (no leaked trigger referencing a removed element)', async () => {
    // Confirmed necessary by direct reproduction: @gsap/react's own unmount cleanup calls
    // `context.revert()`, which (traced directly in node_modules/gsap/gsap-core.js) calls
    // `this.kill(config || {})` with an always-truthy `{}` -- Context.kill's "soft revert" branch, which
    // does NOT remove a tracked ScrollTrigger from the registry (only Context.kill's falsy-argument
    // branch, `this.data.forEach(e => e.kill && e.kill())`, actually does). useScene's own explicit
    // unmount cleanup calls `.kill()` on tagged ScrollTriggers directly, independent of that.
    const elRef = createRef<HTMLDivElement>()
    const { unmount } = render(<div ref={elRef}><TriggerScene elRef={elRef} /></div>)
    await waitFrame()
    expect(ScrollTrigger.getAll().filter(st => st.vars.id === 'test-scene-1').length).toBe(1)
    unmount()
    expect(ScrollTrigger.getAll().filter(st => st.vars.id === 'test-scene-1').length).toBe(0)
  })
})
