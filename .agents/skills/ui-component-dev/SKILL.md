---
name: ui-component-dev
description: Build one of a project's 6 required interactive controls end to end (component, state wiring, computation call, reset/undo, error states, keyboard/touch parity). Use once per control, owned by frontend-engineer.
---

# UI Component Development

**When:** During M2/M3 milestones, one invocation per required interaction.
**Input:** one row from `specifications/REQUIREMENTS.yaml` (e.g. `CAS-INT-001`), the Data/AI Engineer's fixture/Worker interface.

## Procedure

1. Read the requirement's given/when/then. Confirm which computation path it uses: live Worker call or matched versioned fixture lookup.
2. Build the control (React component + state hook), wired to the real computation path — never a value derived from animation progress or `Math.random()`.
3. Implement: reset/undo to baseline, disabled/infeasible-input feedback, loading state while the Worker runs, keyboard equivalent for every pointer action, touch target sizing on mobile.
4. Write a component test asserting: the control changes the documented state, an invalid input is rejected with the right diagnostic, reset restores baseline exactly.
5. Update the requirement's status in `REQUIREMENTS.yaml` to `implemented` (not `tested`/`verified` — that's QA's call).

**Output:** one working control + its component test, requirement status updated.
**Failure condition:** a control that changes visual state without a traceable computation call behind it.
**Recovery:** A control failing its own test goes back through this skill, not forward to QA -- don't hand off a known-broken control hoping QA catches it; that wastes an independent-verification pass on something not actually ready.
