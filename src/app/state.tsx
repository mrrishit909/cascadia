import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react'
import type { DcopfResult, ScenarioParams } from '../engine/dcopf'
import { createLpClient, SupersededError } from '../workers/lpClient'
import type { Case30, Precomputed, Scenario } from '../engine/types'

// Single source of truth.
//
// D1 fix (race: a confirmed action silently lost if another action fires before
// the first's solve resolves): `removedBus`/`lineCapacity` are the LAST
// CONFIRMED (solved) scenario. While a solve is in flight, `pending` holds the
// scenario intent that solve is for -- set synchronously the moment an action
// is confirmed, before the async Worker roundtrip. A second action started
// before the first resolves must build its request from `pending` (if set),
// not from the stale `removedBus`/`lineCapacity`, or it silently drops the
// first action's not-yet-applied intent. `pending` is cleared on both success
// (promoted into removedBus/lineCapacity) and failure (discarded, so a failed
// attempt doesn't leave a mismatched intent stuck in state -- the UI keeps
// showing the last known-good result plus the error).
//
// Stale *results* are already handled correctly by lpClient (SupersededError
// rejects every older in-flight request the instant a newer one is issued);
// this only fixes request *construction* racing ahead of state.
export interface Scen { removedBus: number | null; lineCapacity: Record<number, number> }
export interface AppState {
  load: 'loading' | 'ready' | 'error'
  error?: string
  scenario?: Scenario
  network?: Case30
  result?: Precomputed
  baseline?: Precomputed // exact loaded object; reset restores this reference
  selectedBus: number | null // chosen, awaiting confirm
  solve: 'idle' | 'solving' | 'error'
  solveError?: string
  removedBus: number | null
  lineCapacity: Record<number, number> // line idx -> capacity factor
  selectedLine: number | null
  pending: Scen | null // scenario intent of the in-flight solve, if any
  // Bumped by 'reset'. lpClient's SupersededError only fires when a NEW solve()
  // call supersedes an OLDER one -- 'reset' dispatches straight to the reducer
  // and never calls solve(), so an already-in-flight Worker computation is not
  // cancelled by a reset and will resolve normally later. Without this guard,
  // that stale resolution's 'solved' dispatch would silently overwrite the
  // just-reset state once it eventually arrives. removeBus/setCapacity capture
  // the epoch before solving and check it against the current epoch (via a
  // ref, since their own closure would otherwise see the stale value) after
  // the solve resolves, skipping the dispatch if a reset happened in between.
  epoch: number
}
export type Action =
  | { type: 'loaded'; scenario: Scenario; network: Case30; result: Precomputed }
  | { type: 'failed'; error: string }
  | { type: 'solved'; result: Precomputed; scenario: Scen }
  | { type: 'selectLine'; line: number | null }
  | { type: 'select'; bus: number | null }
  | { type: 'solving'; scenario: Scen }
  | { type: 'solveFailed'; error: string }
  | { type: 'reset' }

const initial: AppState = { load: 'loading', removedBus: null, selectedBus: null, solve: 'idle', lineCapacity: {}, selectedLine: null, pending: null, epoch: 0 }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'loaded': return { ...s, load: 'ready', scenario: a.scenario, network: a.network, result: a.result, baseline: a.result }
    case 'failed': return { ...s, load: 'error', error: a.error }
    case 'solved': return { ...s, result: a.result, removedBus: a.scenario.removedBus, lineCapacity: a.scenario.lineCapacity, pending: null, selectedBus: null, solve: 'idle', solveError: undefined }
    case 'selectLine': return { ...s, selectedLine: a.line }
    case 'select': return { ...s, selectedBus: a.bus }
    case 'solving': return { ...s, solve: 'solving', solveError: undefined, pending: a.scenario }
    case 'solveFailed': return { ...s, solve: 'error', solveError: a.error, pending: null }
    case 'reset': return { ...s, result: s.baseline, removedBus: null, lineCapacity: {}, selectedLine: null, selectedBus: null, solve: 'idle', solveError: undefined, pending: null, epoch: s.epoch + 1 }
  }
}

export type Solver = (c: Case30, sc: ScenarioParams) => Promise<DcopfResult>
const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action>; removeBus: (bus: number) => Promise<void>; setCapacity: (line: number, factor: number, allowShed: boolean) => Promise<void> } | null>(null)

// Real Worker, created lazily on first solve.
function workerSolver(): Solver {
  let client: ReturnType<typeof createLpClient> | undefined
  return (c, sc) => {
    client ??= createLpClient(new Worker(new URL('../workers/lpWorker.ts', import.meta.url), { type: 'module' }) as never)
    return client.solve(c, sc)
  }
}
export const useApp = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp outside AppProvider')
  return c
}

const get = async <T,>(path: string): Promise<T> => {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${path}`)
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`)
  return r.json()
}

export function AppProvider({ children, solver }: { children: ReactNode; solver?: Solver }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const epochRef = useRef(state.epoch)
  useEffect(() => { epochRef.current = state.epoch }, [state.epoch])
  useEffect(() => {
    (async () => {
      try {
        const scenario = await get<Scenario>('scenarios/baseline.json')
        const [network, result] = await Promise.all([
          get<Case30>(scenario.case),
          get<Precomputed>('precomputed/baseline.json'),
        ])
        dispatch({ type: 'loaded', scenario, network, result })
      } catch (e) {
        dispatch({ type: 'failed', error: String(e) })
      }
    })()
  }, [])
  const solve = useMemo(() => solver ?? workerSolver(), [solver])
  // Base intent for a new request: the in-flight solve's scenario if one is
  // pending (so a second action builds on top of the first, not-yet-applied
  // one), else the last confirmed scenario. This is the D1 fix -- see the
  // AppState comment above.
  const base = useCallback((): Scen => state.pending ?? { removedBus: state.removedBus, lineCapacity: state.lineCapacity },
    [state.pending, state.removedBus, state.lineCapacity])
  const removeBus = useCallback(async (bus: number) => {
    if (!state.network) return
    const myEpoch = epochRef.current
    const scenario: Scen = { removedBus: bus, lineCapacity: base().lineCapacity }
    dispatch({ type: 'solving', scenario })
    try {
      const r = await solve(state.network, { removed_buses: [bus], line_capacity_factor: scenario.lineCapacity })
      if (epochRef.current !== myEpoch) return // reset happened while this solve was in flight; discard
      dispatch({ type: 'solved', scenario, result: {
        id: `bus_removal_${bus}`, label: `Live HiGHS Worker solve: bus ${bus} removed (island-aware DC-OPF)`,
        limitations: state.baseline?.limitations ?? [], result: r } })
    } catch (e) {
      if (epochRef.current !== myEpoch) return
      if (!(e instanceof SupersededError)) dispatch({ type: 'solveFailed', error: e instanceof Error ? e.message : String(e) })
    }
  }, [solve, state.network, state.baseline, base])
  // CAS-INT-005: real Worker solve with one line's capacity factor changed (factor 1 = baseline rating).
  // Other lines' factors and any removed bus stay applied -- built from the pending intent (base()), not
  // the last-confirmed state, so a removal still awaiting its solve is never silently dropped (D1).
  const setCapacity = useCallback(async (line: number, factor: number, allowShed: boolean) => {
    if (!state.network) return
    const myEpoch = epochRef.current
    const prior = base()
    const cap = { ...prior.lineCapacity }
    if (factor === 1) delete cap[line]; else cap[line] = factor
    const scenario: Scen = { removedBus: prior.removedBus, lineCapacity: cap }
    dispatch({ type: 'solving', scenario })
    try {
      const r = await solve(state.network, { line_capacity_factor: cap, allow_shed: allowShed,
        ...(scenario.removedBus !== null && { removed_buses: [scenario.removedBus] }) })
      if (epochRef.current !== myEpoch) return // reset happened while this solve was in flight; discard
      dispatch({ type: 'solved', scenario, result: {
        id: `line_capacity_${line}_x${factor}`, label: `Live HiGHS Worker solve: line ${line} capacity x${factor}${allowShed ? '' : ', shedding disabled'}`,
        limitations: state.baseline?.limitations ?? [], result: r } })
    } catch (e) {
      if (epochRef.current !== myEpoch) return
      if (!(e instanceof SupersededError)) dispatch({ type: 'solveFailed', error: e instanceof Error ? e.message : String(e) })
    }
  }, [solve, state.network, state.baseline, base])
  return <Ctx.Provider value={{ state, dispatch, removeBus, setCapacity }}>{children}</Ctx.Provider>
}
