// DESIGN_SYSTEM.json componentStates.skipIntro: "position: top-right, first in tab order... Enter/Space
// jumps to the final intro frame (identical to reduced-motion state)." Always mounted (never
// conditionally rendered -- this project's standing rule, after the LineOutage mount-bug class an
// independent review found for controls that WERE conditionally mounted); visible and interactive
// whenever `active === 'intro'` (it must be clickable from beat 1 onward, BEFORE the FIG index/Reset
// button's own beat-4 reveal -- it's what MAKES that reveal happen on demand), inert otherwise, since
// there's nothing left to skip once the user has moved on.
export function SkipIntro({ active, onSkip }: { active: string; onSkip: () => void }) {
  const showing = active === 'intro'
  return (
    <button className="skip-intro" data-chrome-visible={showing} inert={!showing} onClick={onSkip}>
      Skip intro
    </button>
  )
}
