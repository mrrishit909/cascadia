import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react'
import type { Case30, Precomputed, Scenario } from '../engine/types'

// Single source of truth. Later controls add actions that set removedBus /
// lineCapacity and replace `result` with a Worker or fixture solve.
export interface AppState {
  load: 'loading' | 'ready' | 'error'
  error?: string
  scenario?: Scenario
  network?: Case30
  result?: Precomputed
  removedBus: number | null
  lineCapacity: Record<number, number> // line idx -> capacity factor
}
export type Action =
  | { type: 'loaded'; scenario: Scenario; network: Case30; result: Precomputed }
  | { type: 'failed'; error: string }
  | { type: 'solved'; result: Precomputed }

const initial: AppState = { load: 'loading', removedBus: null, lineCapacity: {} }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'loaded': return { ...s, load: 'ready', scenario: a.scenario, network: a.network, result: a.result }
    case 'failed': return { ...s, load: 'error', error: a.error }
    case 'solved': return { ...s, result: a.result }
  }
}

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null)
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

export function AppProvider({ children }: { children: ReactNode }) {
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
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>
}
