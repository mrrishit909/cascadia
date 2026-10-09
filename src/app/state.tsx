import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'
import type { DcopfResult, ScenarioParams } from '../engine/dcopf'
import { createLpClient, SupersededError } from '../workers/lpClient'
import type { Case30, Precomputed, Scenario } from '../engine/types'

// Single source of truth. Later controls add actions that set removedBus /
// lineCapacity and replace `result` with a Worker or fixture solve.
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
}
export type Action =
  | { type: 'loaded'; scenario: Scenario; network: Case30; result: Precomputed }
  | { type: 'failed'; error: string }
  | { type: 'solved'; result: Precomputed; removedBus: number | null; lineCapacity?: Record<number, number> }
  | { type: 'selectLine'; line: number | null }
  | { type: 'select'; bus: number | null }
  | { type: 'solving' }
  | { type: 'solveFailed'; error: string }
  | { type: 'reset' }

const initial: AppState = { load: 'loading', removedBus: null, selectedBus: null, solve: 'idle', lineCapacity: {}, selectedLine: null }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'loaded': return { ...s, load: 'ready', scenario: a.scenario, network: a.network, result: a.result, baseline: a.result }
    case 'failed': return { ...s, load: 'error', error: a.error }
    case 'solved': return { ...s, result: a.result, removedBus: a.removedBus, lineCapacity: a.lineCapacity ?? {}, selectedBus: null, solve: 'idle', solveError: undefined }
    case 'selectLine': return { ...s, selectedLine: a.line }
    case 'select': return { ...s, selectedBus: a.bus }
    case 'solving': return { ...s, solve: 'solving', solveError: undefined }
    case 'solveFailed': return { ...s, solve: 'error', solveError: a.error }
    case 'reset': return { ...s, result: s.baseline, removedBus: null, lineCapacity: {}, selectedLine: null, selectedBus: null, solve: 'idle', solveError: undefined }
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
  const removeBus = useCallback(async (bus: number) => {
    if (!state.network) return
    dispatch({ type: 'solving' })
    try {
      const r = await solve(state.network, { removed_buses: [bus], line_capacity_factor: state.lineCapacity })
      dispatch({ type: 'solved', removedBus: bus, lineCapacity: state.lineCapacity, result: {
        id: `bus_removal_${bus}`, label: `Live HiGHS Worker solve: bus ${bus} removed (island-aware DC-OPF)`,
        limitations: state.baseline?.limitations ?? [], result: r } })
    } catch (e) {
      if (!(e instanceof SupersededError)) dispatch({ type: 'solveFailed', error: e instanceof Error ? e.message : String(e) })
    }
  }, [solve, state.network, state.baseline, state.lineCapacity])
  // CAS-INT-005: real Worker solve with one line's capacity factor changed (factor 1 = baseline rating).
  // Other lines' factors and any removed bus stay applied. Latest-wins via lpClient (SupersededError ignored).
  const setCapacity = useCallback(async (line: number, factor: number, allowShed: boolean) => {
    if (!state.network) return
    const cap = { ...state.lineCapacity }
    if (factor === 1) delete cap[line]; else cap[line] = factor
    dispatch({ type: 'solving' })
    try {
      const r = await solve(state.network, { line_capacity_factor: cap, allow_shed: allowShed,
        ...(state.removedBus !== null && { removed_buses: [state.removedBus] }) })
      dispatch({ type: 'solved', removedBus: state.removedBus, lineCapacity: cap, result: {
        id: `line_capacity_${line}_x${factor}`, label: `Live HiGHS Worker solve: line ${line} capacity x${factor}${allowShed ? '' : ', shedding disabled'}`,
        limitations: state.baseline?.limitations ?? [], result: r } })
    } catch (e) {
      if (!(e instanceof SupersededError)) dispatch({ type: 'solveFailed', error: e instanceof Error ? e.message : String(e) })
    }
  }, [solve, state.network, state.baseline, state.lineCapacity, state.removedBus])
  return <Ctx.Provider value={{ state, dispatch, removeBus, setCapacity }}>{children}</Ctx.Provider>
}
