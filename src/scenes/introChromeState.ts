import { useSyncExternalStore } from 'react'

// Presentation state: whether the FIG index, Reset button, and SKIP INTRO have faded in yet.
// ART_DIRECTION.md's opening storyboard, beat 4 (9-12s): "The FIG index, SKIP/ENTER controls and the
// status region fade in." Before that moment, this chrome stays mounted (never conditionally rendered,
// matching the project's standing rule against mount-on-demand controls) but invisible/non-interactive,
// via CSS driven by this store -- not unmounted.
let visible = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function setIntroChromeVisible(v: boolean) { visible = v; emit() }
export function useIntroChromeVisible(): boolean {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => visible)
}
