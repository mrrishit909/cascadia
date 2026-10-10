import { useSyncExternalStore } from 'react'

// Presentation state (never AppState -- see presentationCamera.ts's matching comment), owned by the
// intro sequence: whether the persistent stage is currently showing the intro's own post-fault fixture
// (beat 4, 9-12s: "one preset line opens with a kerf gap... swaps to the post-fault fixture") or
// baseline. App.tsx's Scene reads this to choose which precomputed result/disabledLines the stage shows
// while `active === 'intro'` -- analytical state (AppState) never changes, only which already-computed
// fixture is on screen.
let faultActive = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function setIntroFaultActive(v: boolean) { faultActive = v; emit() }
export function useIntroFaultActive(): boolean {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => faultActive)
}
