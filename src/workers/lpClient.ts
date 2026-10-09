// Main-thread client with latest-wins cancellation. The worker itself cannot interrupt a running
// synchronous solve, so a superseded request is still computed but its result is never delivered.
import type { DcopfResult, ScenarioParams } from '../engine/dcopf'
import type { Case30 } from '../engine/types'
import type { LpReply, LpRequest } from './lpWorker'

export interface WorkerLike { postMessage(m: LpRequest): void; onmessage: ((e: { data: LpReply }) => void) | null }
export class SupersededError extends Error { constructor() { super('superseded by a newer request') } }

export function createLpClient(worker: WorkerLike) {
  let latest = 0
  const pending = new Map<number, { res: (r: DcopfResult) => void; rej: (e: Error) => void }>()
  worker.onmessage = ({ data }) => {
    const p = pending.get(data.id)
    pending.delete(data.id)
    if (!p || data.id !== latest) return // stale: already rejected below
    if (data.ok) p.res(data.result); else p.rej(new Error(data.error))
  }
  return {
    solve(c: Case30, scenario: ScenarioParams = {}): Promise<DcopfResult> {
      const id = ++latest
      for (const [oid, p] of pending) { p.rej(new SupersededError()); pending.delete(oid) }
      return new Promise((res, rej) => { pending.set(id, { res, rej }); worker.postMessage({ id, case: c, scenario }) })
    },
  }
}
