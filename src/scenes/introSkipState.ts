import { useSyncExternalStore } from 'react'

// DESIGN_SYSTEM.json componentStates.skipIntro: "jumps to the final intro frame (identical to
// reduced-motion state)." A tiny signal IntroSequence watches alongside its own reducedMotion check --
// once skipped, treat every subsequent entry into the intro the same way reduced motion would (instant
// end state, no replay), for the rest of the session. Separate from introFixtureState/introChromeState
// (which hold the actual END STATE those two concerns converge to) because IntroSequence is the only
// thing that needs to know WHY it's skipping the animated path, to also clear beat 1-3's opacity work
// instantly instead of leaving it mid-tween.
let skipped = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function setIntroSkipped(v: boolean) { skipped = v; emit() }
export function useIntroSkipped(): boolean {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => skipped)
}
