/// <reference lib="webworker" />
// Web Worker: loads HiGHS WASM once, solves scenarios posted as {id, case, scenario}.
// Every reply echoes the request id; lpClient drops replies that are not the latest.
import highsLoader from 'highs'
import wasmUrl from 'highs/runtime?url'
import { solveDcopf, type CandidateLine, type DcopfResult, type ScenarioParams } from '../engine/dcopf'
import type { Case30 } from '../engine/types'

export interface LpRequest { id: number; case: Case30; scenario: ScenarioParams; candidates?: CandidateLine[] }
export type LpReply = { id: number; ok: true; result: DcopfResult } | { id: number; ok: false; error: string }

const highs = highsLoader({ locateFile: () => wasmUrl })

self.onmessage = async (e: MessageEvent<LpRequest>) => {
  const { id, case: c, scenario, candidates } = e.data
  try {
    const result = solveDcopf(c, await highs, scenario, candidates ?? [])
    self.postMessage({ id, ok: true, result } satisfies LpReply)
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies LpReply)
  }
}
