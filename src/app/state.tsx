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
}
export type Action =
  | { type: 'loaded'; scenario: Scenario; network: Case30; result: Precomputed }
  | { type: 'failed'; error: string }
  | { type: 'solved'; result: Precomputed; removedBus: number | null }
  | { type: 'select'; bus: number | null }
  | { type: 'solving' }
  | { type: 'solveFailed'; error: string }
  | { type: 'reset' }

const initial: AppState = { load: 'loading', removedBus: null, selectedBus: null, solve: 'idle', lineCapacity: {} }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'loaded': return { ...s, load: 'ready', scenario: a.scenario, network: a.network, result: a.result, baseline: a.result }
    case 'failed': return { ...s, load: 'error', error: a.error }
    case 'solved': return { ...s, result: a.result, removedBus: a.removedBus, selectedBus: null, solve: 'idle', solveError: undefined }
    case 'select': return { ...s, selectedBus: a.bus }
    case 'solving': return { ...s, solve: 'solving', solveError: undefined }
    case 'solveFailed': return { ...s, solve: 'error', solveError: a.error }
    case 'reset': return { ...s, result: s.baseline, removedBus: null, selectedBus: null, solve: 'idle', solveError: undefined }
  }
}

export type Solver = (c: Case30, sc: ScenarioParams) => Promise<DcopfResult>
const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action>; removeBus: (bus: number) => Promise<void> } | null>(null)

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
      const r = await solve(state.network, { removed_buses: [bus] })
      dispatch({ type: 'solved', removedBus: bus, result: {
        id: `bus_removal_${bus}`, label: `Live HiGHS Worker solve: bus ${bus} removed (island-aware DC-OPF)`,
        limitations: state.baseline?.limitations ?? [], result: r } })
    } catch (e) {
      if (!(e instanceof SupersededError)) dispatch({ type: 'solveFailed', error: e instanceof Error ? e.message : String(e) })
    }
  }, [solve, state.network, state.baseline])
  return <Ctx.Provider value={{ state, dispatch, removeBus }}>{children}</Ctx.Provider>
}
