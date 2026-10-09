---
name: responsive-audit
description: Verify the 3 required responsive compositions (desktop/tablet/mobile) are deliberate redesigns, not the same layout reflowed. Use before Gate G4, owned by qa-engineer.
---

# Responsive Interface Auditing

**When:** Before Gate G4, alongside browser-design-review.
**Input:** screenshots at 1440x900, 768x1024, 390x844 (plus 1920x1080, 360px narrow) from `verification/SCREENSHOTS/`.

## Procedure

1. Compare the three required viewports for each chapter. A pass requires a genuinely different composition per the project's responsiveness contract (desktop: canvas-led with anchored inspector; tablet: reduced depth, stacked inspector; mobile: touch-first bottom sheet, large targets, 2D/static fallback if WebGL-based) — not just CSS reflow of the same elements.
2. Confirm no hover-only functionality survives on mobile/touch.
3. Confirm touch targets meet a minimum size and there's no horizontal scroll trap.
4. Check the 360px narrow viewport specifically — this is where bottom-sheet controls and large touch targets most often break first.

**Output:** per-chapter pass/fail against the 3-composition requirement.
**Failure condition:** any chapter where mobile is just desktop scaled down (this is the exact SIGNALROOM-style failure the portfolio directive calls out: zero deliberate responsive compositions shipped under green tests).
**Recovery:** A failing chapter goes back to frontend-engineer/motion-engineer named specifically (which breakpoint, what's wrong); re-screenshot only that chapter's breakpoints after the fix, not the whole project.
