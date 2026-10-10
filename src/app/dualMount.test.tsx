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
import { AlterCapacity } from '../interactions/AlterCapacity'
import { LineOutage } from '../interactions/LineOutage'
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
  const utils = render(<AppProvider solver={async (c, sc, cands) => solveDcopf(c, highs, sc, cands)}>{children}</AppProvider>)
  await screen.findAllByText(waitForText)
  return utils
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

describe('dual mount: AlterCapacity (draft lifted to AppState.capDraft, selectLine resync moved into the reducer)', () => {
  it('selecting a line and dragging the capacity slider in instance A shows identically in instance B', async () => {
    await setup(<><div data-testid="home"><AlterCapacity /></div><div data-testid="lab"><AlterCapacity /></div></>, "Alter line capacity")
    const home = within(screen.getByTestId('home'))
    const lab = within(screen.getByTestId('lab'))
    fireEvent.change(home.getByLabelText('Line'), { target: { value: '9' } })
    await waitFor(() => expect((lab.getByLabelText('Line') as HTMLSelectElement).value).toBe('9'))
    fireEvent.change(home.getByRole('slider'), { target: { value: '0.5' } })
    await waitFor(() => expect(lab.getByTestId('cap-factor')).toHaveTextContent('0.50x'))
  })

  it('REGRESSION: remounting instance B does not clobber an uncommitted draft the user is editing in instance A', async () => {
    // This is the exact bug class the selectLine-resync-into-the-reducer fix closes: a newly (re)mounted
    // instance's old per-component mount-time resync effect would fire with the LAST-CONFIRMED value and
    // overwrite the shared capDraft, discarding whatever uncommitted edit instance A had in progress.
    const { rerender } = await setup(<div data-testid="home"><AlterCapacity /></div>, "Alter line capacity")
    const home = within(screen.getByTestId('home'))
    fireEvent.change(home.getByLabelText('Line'), { target: { value: '9' } })
    fireEvent.change(home.getByRole('slider'), { target: { value: '0.42' } }) // uncommitted draft, no Apply/debounce fired yet
    await waitFor(() => expect(home.getByTestId('cap-factor')).toHaveTextContent('0.42x'))
    const highs = await highsLoader()
    rerender(
      <AppProvider solver={async (c, sc, cands) => solveDcopf(c, highs, sc, cands)}>
        <div data-testid="home"><AlterCapacity /></div>
        <div data-testid="lab"><AlterCapacity /></div>
      </AppProvider>,
    )
    // instance B mounts fresh (its own mount-time machinery runs) -- A's draft must survive untouched
    expect(home.getByTestId('cap-factor')).toHaveTextContent('0.42x')
    const lab = within(screen.getByTestId('lab'))
    expect(lab.getByTestId('cap-factor')).toHaveTextContent('0.42x')
  })
})

describe('dual mount: LineOutage (selection lifted to AppState.outageLine)', () => {
  it('selecting a line in instance A shows identically in instance B', async () => {
    await setup(<><div data-testid="home"><LineOutage /></div><div data-testid="lab"><LineOutage /></div></>, "Line outage")
    const home = within(screen.getByTestId('home'))
    const lab = within(screen.getByTestId('lab'))
    fireEvent.change(home.getByLabelText('Line to disable'), { target: { value: '0' } })
    await waitFor(() => expect((lab.getByLabelText('Line to disable') as HTMLSelectElement).value).toBe('0'))
  })

  it('REGRESSION: mounting a second instance while a line is already selected does not steal focus to its trigger button', async () => {
    // Found by advisor review before this ever shipped in a real chapter shell: the focus-management
    // effect (confirming -> focus Confirm/trigger) has no initial-mount guard, so it ALSO fires once on
    // every mount, not just on confirming's later transitions. Since outageLine is shared AppState, a
    // SECOND mount (chapter's lab placement) while a line is already selected renders that instance's
    // own "Disable line"/"Restore line" trigger button immediately and the effect's mount-time run
    // yanks keyboard focus to it -- regardless of what the user was actually doing elsewhere on the page.
    const { rerender } = await setup(<div data-testid="home"><LineOutage /></div>, "Line outage")
    const home = within(screen.getByTestId('home'))
    fireEvent.change(home.getByLabelText('Line to disable'), { target: { value: '0' } })
    const triggerA = home.getByText('Disable line')
    triggerA.focus()
    expect(document.activeElement).toBe(triggerA)
    const highs = await highsLoader()
    rerender(
      <AppProvider solver={async (c, sc, cands) => solveDcopf(c, highs, sc, cands)}>
        <div data-testid="home"><LineOutage /></div>
        <div data-testid="lab"><LineOutage /></div>
      </AppProvider>,
    )
    // instance B mounts fresh with outageLine already '0' (shared), so its own trigger button renders
    // immediately -- focus must stay wherever the user actually put it, not jump to instance B
    expect(document.activeElement).toBe(triggerA)
  })
})
