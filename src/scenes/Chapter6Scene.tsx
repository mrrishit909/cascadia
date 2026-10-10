import { useScene } from './useScene'

// ART_DIRECTION.md per-chapter motion table, row 6 (the laboratory): "Any control commit, then Worker
// result" drives "last result dims to 60% while solving, then all changed elements transition together
// on result" (feedback 240ms, state 480ms). Chapter 6 is ALREADY functionally complete -- it hosts all
// 7 controls at their `placement="lab"` mount and the stage is already always-live there (App.tsx's own
// existing story/lab switch) -- this is motion-only, hooking into the EXISTING shared `state.solve`
// status machine (`'idle'|'solving'|'error'`, already driving `StatusRegion`) rather than any new
// analytical work. `solving` is already `active==='ch6' && state.solve==='solving'`, computed once in
// App.tsx so this scene doesn't need to know about `state` at all.
//
// Reduced motion still reflects the REAL state (dimmed while a solve is genuinely in flight), just
// without an animated transition -- "Instant swap" in the motion table means instant, not skipped;
// a user relying on reduced motion still needs the dim/undim signal, just not eased.
export function Chapter6Scene({ stageRef, active, solving }: {
  stageRef: React.RefObject<HTMLDivElement | null>
  active: string
  solving: boolean
}) {
  useScene('ch6-scene', stageRef, ({ gsap, reducedMotion }) => {
    const stage = stageRef.current
    if (!stage) return
    gsap.killTweensOf(stage)
    if (active !== 'ch6') { gsap.set(stage, { opacity: 1 }); return }
    const targetOpacity = solving ? 0.6 : 1
    if (reducedMotion) { gsap.set(stage, { opacity: targetOpacity }); return }
    gsap.to(stage, { opacity: targetOpacity, duration: solving ? 0.24 : 0.48, ease: 'power1.out' })
  }, [active, solving])
  return null
}
