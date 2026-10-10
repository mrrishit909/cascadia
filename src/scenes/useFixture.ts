import { useEffect, useState } from 'react'

// Story/lab boundary (docs/planning/cascadia/CHAPTER_ARCHITECTURE.md section 1): chapters display
// oracle-generated, precomputed fixtures and NEVER call the live Worker/solver. This hook fetches one
// such fixture directly (same public/data/<path> convention state.tsx's own `get()` uses), independent
// of AppState -- a chapter's story is not scenario state, so it has no business living in the reducer.
export function useFixture<T>(path: string): T | null {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/${path}`)
      .then(r => { if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`); return r.json() })
      .then(d => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
    return () => { cancelled = true }
  }, [path])
  return data
}
