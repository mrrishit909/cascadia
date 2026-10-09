// Main-thread client with latest-wins cancellation. The worker itself cannot interrupt a running
// synchronous solve, so a superseded request is still computed but its result is never delivered.
import type { CandidateLine, DcopfResult, DownElement, RestoreSeq, ScenarioParams } from '../engine/dcopf'
import type { Case30 } from '../engine/types'
import type { LpReply, LpRequest } from './lpWorker'

export interface WorkerLike { postMessage(m: LpRequest): void; onmessage: ((e: { data: LpReply }) => void) | null }
export class SupersededError extends Error { constructor() { super('superseded by a newer request') } }

export function createLpClient(worker: WorkerLike) {
  let latest = 0
  const pending = new Map<number, { res: (r: Extract<LpReply, { ok: true }>) => void; rej: (e: Error) => void }>()
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id)
    pending.delete(data.id)
    if (!p || data.id !== latest) return // stale: already rejected below
    if (data.ok) p.res(data); else p.rej(new Error(data.error))
  }
  const fire = (id: number, req: LpRequest) => {
    for (const [oid, p] of pending) { p.rej(new SupersededError()); pending.delete(oid) }
    return new Promise<Extract<LpReply, { ok: true }>>((res, rej) => { pending.set(id, { res, rej }); worker.postMessage(req) })
  }
  return {
    solve(c: Case30, scenario: ScenarioParams = {}, candidates?: CandidateLine[]): Promise<DcopfResult> {
      const id = ++latest
      return fire(id, { id, case: c, scenario, candidates }).then((r) => (r as { result: DcopfResult }).result)
    },
    // CAS-INT-006: ranks all orderings of `down`, best-first. Shares the same latest-wins supersede
    // queue as solve() -- the two request kinds use one id sequence, so a rank() always supersedes an
    // in-flight solve() and vice versa, matching the single-outstanding-request model everywhere else.
    rank(c: Case30, down: DownElement[], base?: ScenarioParams, candidates?: CandidateLine[]): Promise<RestoreSeq[]> {
      const id = ++latest
      return fire(id, { id, kind: 'rank', case: c, down, base, candidates }).then((r) => (r as { ranking: RestoreSeq[] }).ranking)
    },
  }
}
