---
name: a11y-audit
description: Verify WCAG-aligned keyboard focus, labels, contrast, motion preferences, and screen-reader semantics for a project. Use before Gate G4/G5, owned by qa-engineer, using axe-core and manual keyboard-only navigation.
---

# Accessibility Auditing

**When:** Before Gate G4/G5.
**Input:** the production preview build.

## Procedure

1. Run axe-core against every chapter/scene. Fix or explicitly defer (as a documented P2, never silently) every violation.
2. Unplug the mouse: navigate the entire page, including all 6 required interactive controls, using only keyboard. Every control must have a reachable, operable keyboard path with visible focus.
3. Toggle `prefers-reduced-motion` at the OS level (not just a code-level flag check) and confirm the actual rendered page responds.
4. Check color contrast against the real rendered tokens (not the design spec's intended values) at normal and high-contrast settings.
5. Spot-check screen-reader semantics: are state changes (e.g. a recomputed result) announced via `aria-live`, not just visually updated?

**Output:** an axe-core report + a manual keyboard-navigation pass/fail list.
**Failure condition:** any P0/P1 control unreachable by keyboard, or a reduced-motion toggle that does nothing when actually tested.
**Recovery:** Fix P0/P1 violations before re-running the full audit; don't re-scan everything after each single fix. For a violation that can't be fixed without a larger redesign, document it as a deferred P2 with the Orchestrator's sign-off, never silently drop it from the report.
