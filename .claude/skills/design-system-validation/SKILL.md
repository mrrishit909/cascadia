---
name: design-system-validation
description: Check an implemented frontend actually matches its own specifications/DESIGN_SYSTEM.json (colors, type scale, spacing, grid) rather than drifting during implementation. Use after frontend-engineer or motion-engineer finishes a scene, before QA's visual pass.
---

# Design System Validation

**When:** After each chapter/scene is implemented, before it's handed to QA.
**Input:** `specifications/DESIGN_SYSTEM.json`, the rendered page (via browser automation or a built preview).

## Procedure

1. Extract actual computed styles from the rendered page (colors, font-family, font sizes, spacing values) using browser devtools/automation, not by reading the source CSS alone — CSS can define a token that isn't actually applied.
2. Diff against `DESIGN_SYSTEM.json`. Flag any hex color, font, or spacing value used in the live page that isn't in the token set.
3. Check component states (hover/focus/disabled/error) are all implemented, not just the default state.
4. Confirm the chapter's composition archetype matches what creative-direction assigned it (no accidental convergence with an adjacent chapter).

**Output:** a pass/fail list of token drift, one line per violation with the actual vs. expected value.
**Failure condition:** any hardcoded color/spacing value not traceable to a design token.
**Recovery:** Fix drift at the token source (DESIGN_SYSTEM.json or the component), not by adding a one-off override; re-run this skill after the fix to confirm no new drift was introduced.
