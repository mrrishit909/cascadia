// Architecture-stabilization gate: proves two mounted instances of a control (its home chapter +
// chapter 6's laboratory, per docs/ART_DIRECTION.md's chapter table) share state correctly, rather
// than each owning an independent stale copy. Real Worker (HiGHS WASM), not mocked -- per this
// project's own rule that async interactions must be tested against the real runtime.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import highsLoader from 'highs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { solveDcopf } from '../engine/dcopf'
import { AppProvider } from './state'
import { IncreaseLoad } from '../interactions/IncreaseLoad'
import { ReduceGenerator } from '../interactions/ReduceGenerator'
// CompareRestoration's dual-mount Worker-count proof lives in e2e/dualMount.spec.ts instead of here:
// jsdom (this file's environment) has no real Worker constructor to intercept/count, and that proof
// is only meaningful against the real browser runtime anyway.

const files = import.meta.glob('/public/data/**/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>
afterEach(() => vi.unstubAllGlobals())
const stubFetch = () => vi.stubGlobal('fetch', async (url: string) => ({
  ok: true, json: async () => (await files[`/public${url.slice(url.indexOf('/data/'))}`]()),
}))

async function setup(children: React.ReactNode, waitForText: string) {
  stubFetch()
  const highs = await highsLoader()
  render(<AppProvider solver={async (c, sc, cands) => solveDcopf(c, highs, sc, cands)}>{children}</AppProvider>)
  await screen.findAllByText(waitForText)
}

describe('dual mount: IncreaseLoad (draft lifted to AppState.loadDraft)', () => {
  it('selecting a bus and dragging the slider in instance A shows identically in instance B', async () => {
    await setup(<><div data-testid="home"><IncreaseLoad /></div><div data-testid="lab"><IncreaseLoad /></div></>, "Increase load")
    const home = within(screen.getByTestId('home'))
    const lab = within(screen.getByTestId('lab'))
    fireEvent.change(home.getByLabelText('Load bus'), { target: { value: '1' } })
    // selection propagates to the OTHER instance immediately (same AppState.loadDraft)
    await waitFor(() => expect((lab.getByLabelText('Load bus') as HTMLSelectElement).value).toBe('1'))
    fireEvent.change(home.getByLabelText('Load multiplier'), { target: { value: '4' } })
    await waitFor(() => expect(lab.getByTestId('load-factor')).toHaveTextContent('4.00x'))
    expect(home.getByTestId('load-factor')).toHaveTextContent('4.00x')
    // a CONFIRMED apply from instance B must also reflect back into instance A
    fireEvent.click(lab.getByText('Apply load'))
    await waitFor(() => expect(home.getByTestId('load-unserved')).not.toHaveTextContent('n/a'))
    expect(home.getByTestId('load-unserved').textContent).toBe(lab.getByTestId('load-unserved').textContent)
  })

  it('every [id] on the page is unique with two instances mounted (useId(), not hardcoded)', async () => {
    await setup(<><IncreaseLoad /><IncreaseLoad /></>, "Increase load")
    const ids = Array.from(document.querySelectorAll('[id]')).map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('dual mount: ReduceGenerator (draft lifted to AppState.genDraft)', () => {
  it('selecting a generator and setting Pmax in instance A shows identically in instance B', async () => {
    await setup(<><div data-testid="home"><ReduceGenerator /></div><div data-testid="lab"><ReduceGenerator /></div></>, "Reduce generator")
    const home = within(screen.getByTestId('home'))
    const lab = within(screen.getByTestId('lab'))
    fireEvent.change(home.getByLabelText('Generator'), { target: { value: '0' } })
    await waitFor(() => expect((lab.getByLabelText('Generator') as HTMLSelectElement).value).toBe('0'))
    fireEvent.change(home.getByLabelText('Pmax'), { target: { value: '10' } })
    await waitFor(() => expect(lab.getByTestId('gen-pmax')).toHaveTextContent('10 MW'))
  })
})
