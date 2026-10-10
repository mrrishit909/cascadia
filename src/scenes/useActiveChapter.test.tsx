import { act, render, screen } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { useActiveChapter } from './useActiveChapter'
import { activateChapter } from '../test-setup'

// Probe mirrors Scene's real shape: hooks called unconditionally, but the chapter <section> markup
// itself only mounts once some async condition resolves (Scene's own AppState fetch) -- NOT on the
// very first render, which is what exposed the real bug this test guards.
function Probe() {
  const active = useActiveChapter(['intro', 'ch1'])
  const [ready, setReady] = useState(false)
  useEffect(() => { Promise.resolve().then(() => setReady(true)) }, [])
  if (!ready) return <p>Loading...</p>
  return (
    <div>
      <p data-testid="active">{active}</p>
      <section id="intro">intro</section>
      <section id="ch1">ch1</section>
    </div>
  )
}

describe('useActiveChapter', () => {
  it('REGRESSION: retries setup once chapter sections mount AFTER an async loading gate, not just on first render', async () => {
    // Real bug found while debugging this exact scenario (App.tsx's Scene): the hook's effect ran once
    // on the initial "Loading baseline" render (no chapter <section>s exist yet), found zero elements,
    // bailed out via its own guard clause, and never ran again -- its dependency array doesn't change
    // once the real chapter markup mounts, so the active chapter stayed stuck forever in every real page
    // load, not just in tests.
    render(<Probe />)
    await screen.findByTestId('active')
    act(() => activateChapter('ch1'))
    expect(screen.getByTestId('active')).toHaveTextContent('ch1')
  })
})
