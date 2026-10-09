import type { AppState, Scen } from './state'

// docs/planning/cascadia/CHAPTER_ARCHITECTURE.md section 3: each chapter shows its own story fixture
// until ITS OWN control(s) diverge from baseline, independent of every other chapter. "Baseline" here
// means the literal default Scen values the 'reset' reducer case restores (state.tsx), NOT
// `state.baseline` -- that field holds the baseline RESULT object (Precomputed), not a Scen, and an
// object-identity check against it breaks the instant a re-solve allocates a fresh (but
// value-identical) result, e.g. dragging a slider back to its starting value. setLoadScale/setGenPmax/
// setCapacity already delete a field's key when it's set back to its default (state.tsx), so an empty
// map or default scalar genuinely means "no live edit from this chapter's control," with no identity
// pitfall.
export const chapter2Diverged = (s: Pick<Scen, 'loadScale' | 'genPmax'>): boolean =>
  Object.keys(s.loadScale).length > 0 || Object.keys(s.genPmax).length > 0

export const chapter3Diverged = (s: Pick<Scen, 'lineCapacity' | 'allowShed'>): boolean =>
  Object.keys(s.lineCapacity).length > 0 || s.allowShed !== true

export const chapter4Diverged = (s: Pick<Scen, 'removedBus' | 'disabledLines'>): boolean =>
  s.removedBus !== null || s.disabledLines.length > 0

// CAS-INT-006 is a separate subsystem (its own Worker, AppState.restoration) with no "baseline" scenario
// of its own -- divergence is simply "has the user run at least one Compare."
export const chapter5Diverged = (restoration: Pick<AppState['restoration'], 'ranking'>): boolean =>
  restoration.ranking !== undefined
