import { useApp } from './state'

// Chapter-shell prep: this button used to live inside RemoveNode.tsx as the app's single "Reset to
// baseline" control. RemoveNode is one of the 7 controls that will mount twice (home chapter + chapter
// 6 lab, per docs/ART_DIRECTION.md's chapter table) -- a reset button owned by a dual-mounted component
// would duplicate the instant that landed, and every `getByRole('button', {name: 'Reset to baseline'})`
// locator across the e2e suite would need scoping. Moved here, to its own always-single-mount home in
// App.tsx, ahead of that work rather than as a reactive fix once it broke.
export function ResetButton() {
  const { state, dispatch } = useApp()
  const { removedBus, pending, result, baseline } = state
  if (!result) return null
  return (
    <button disabled={removedBus === null && pending === null && result === baseline} onClick={() => dispatch({ type: 'reset' })}>
      Reset to baseline
    </button>
  )
}
