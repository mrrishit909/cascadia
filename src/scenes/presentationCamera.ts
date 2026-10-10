import { useSyncExternalStore } from 'react'
import type { Camera } from '../visualization/NetworkView'

export type { Camera }

const W = 960, H = 640
export const FULL_CAMERA: Camera = { x: 0, y: 0, w: W, h: H }

// Centralized presentation-camera controller (cinematic-motion directive phase 3). Analytical state
// (AppState, state.tsx) and presentation state are kept strictly separate -- this module owns ONLY the
// persistent stage's current viewBox, nothing about the electrical scenario. A plain module-level store
// (not React Context) because there is genuinely only ONE live camera for the ONE persistent stage, and
// every scene in the app needs to read or claim it; a context would need a single top-level provider
// wrapping the whole tree anyway, which this already behaves as.
let currentCamera: Camera = FULL_CAMERA
let currentOwner: string | null = null
const listeners = new Set<() => void>()
function emit() { listeners.forEach(l => l()) }

// Camera-ownership rule (phase 3, rule 1: "Exactly one authoritative presentation-camera output
// controls the persistent visualization at any moment"). `claimCamera` is the ONLY way to change the
// live camera, and a write is applied only when `ownerId` matches the chapter that's CURRENTLY active
// (per useActiveChapter) -- a stale write from a scene that's no longer active (a GSAP scrub callback
// firing after the user has already scrolled away, or an unmounting scene's in-flight tween) is
// silently dropped rather than clobbering whatever the now-active scene set. This is the actual
// enforcement mechanism for "multiple scenes may define camera targets, but must not simultaneously
// compete to control the live camera" -- not a convention, a guard every write passes through.
export function claimCamera(ownerId: string, activeChapterId: string, camera: Camera) {
  if (ownerId !== activeChapterId) return
  currentOwner = ownerId
  currentCamera = camera
  emit()
}

// Deterministic restoration (phase 3, rule 10: "All camera values must remain valid... deterministic
// restoration of a valid camera state"). Called whenever the active chapter changes (App.tsx's Scene),
// BEFORE that chapter's own scene has a chance to claim anything -- so a chapter that does no camera
// work at all (chapters 1, 4, 5, 6 are state/result-driven per ART_DIRECTION.md's motion table, not
// scroll-scrubbed) still gets a known-good default rather than inheriting whatever the PREVIOUS
// chapter's scrub left behind.
export function resetCameraToDefault(activeChapterId: string) {
  currentOwner = activeChapterId
  currentCamera = FULL_CAMERA
  emit()
}

export function usePresentationCamera(): Camera {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => currentCamera,
  )
}

// Test/debug only: which scene last successfully wrote the camera.
export function getCameraOwner(): string | null { return currentOwner }

// Linear interpolation between two cameras, shared by every scroll-scrubbed chapter (2's pan into
// the editorial split, 3's zoom into the corridor strip) so each one doesn't hand-roll its own lerp.
export function lerpCamera(from: Camera, to: Camera, t: number): Camera {
  const c = Math.max(0, Math.min(1, t))
  return { x: from.x + (to.x - from.x) * c, y: from.y + (to.y - from.y) * c, w: from.w + (to.w - from.w) * c, h: from.h + (to.h - from.h) * c }
}
