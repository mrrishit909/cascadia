/// <reference lib="webworker" />
// Web Worker: loads HiGHS WASM once, solves scenarios posted as {id, case, scenario}.
// Every reply echoes the request id; lpClient drops replies that are not the latest.
import highsLoader from 'highs'
import wasmUrl from 'highs/runtime?url'
import { rankRestoration, solveDcopf, type CandidateLine, type DcopfResult, type DownElement, type RestoreSeq, type ScenarioParams } from '../engine/dcopf'
import type { Case30 } from '../engine/types'

export interface SolveRequest { id: number; kind?: 'solve'; case: Case30; scenario: ScenarioParams; candidates?: CandidateLine[] }
// CAS-INT-006: ranks all orderings of `down` best-first by served_mw_steps. Not part of the shared
// scenario machinery in state.tsx (removedBus/disabledLines/etc.) -- a standalone what-if query over a
// fault scenario, so it gets its own request kind rather than overloading `scenario`.
export interface RankRequest { id: number; kind: 'rank'; case: Case30; down: DownElement[]; base?: ScenarioParams; candidates?: CandidateLine[] }
export type LpRequest = SolveRequest | RankRequest
export type LpReply = { id: number; ok: true; result: DcopfResult } | { id: number; ok: true; ranking: RestoreSeq[] } | { id: number; ok: false; error: string }

const highs = highsLoader({ locateFile: () => wasmUrl })

self.onmessage = async (e: MessageEvent<LpRequest>) => {
  const { id } = e.data
  try {
    if (e.data.kind === 'rank') {
      const { case: c, down, base, candidates } = e.data
      const ranking = rankRestoration(c, await highs, down, undefined, base ?? {}, candidates ?? [])
      self.postMessage({ id, ok: true, ranking } satisfies LpReply)
    } else {
      const { case: c, scenario, candidates } = e.data
      const result = solveDcopf(c, await highs, scenario, candidates ?? [])
      self.postMessage({ id, ok: true, result } satisfies LpReply)
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies LpReply)
  }
}
