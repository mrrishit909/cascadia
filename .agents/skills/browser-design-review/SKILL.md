---
name: browser-design-review
description: Load the project's production build in a real browser and visually inspect every chapter at every required breakpoint, using Codex-in-chrome or Playwright screenshots. Use before Gate G4, owned by qa-engineer and creative-director jointly, and never skipped in favor of reading the component code.
---

# Browser-Based Design Review

**When:** Before Gate G4 (creative verification), after `npm run build && npm run preview`.
**Input:** the running production preview, `specifications/DESIGN_SYSTEM.json`, the 6 chapter compositions.

## Procedure

1. Start the production preview (never a dev server — dev-mode styling/perf can differ from what ships).
2. For each of the 6 chapters, capture a screenshot at desktop (1440x900), tablet (768x1024), and mobile (390x844). Also capture the opening sequence (intro-complete state) and one flagship-control before/after pair.
3. **Actually look at each image.** Confirm the 6 chapters are visually distinct from each other (per their assigned composition archetype) — not merely different text over the same layout.
4. Check high-contrast / reduced-motion variants render correctly, not just the default.
5. Record which real browser(s) were used (Chromium/Firefox/WebKit) and which were skipped, honestly.
6. Fill in one block of `templates/DESIGN_REVIEW_TEMPLATE.md` (copied to this project's `verification/DESIGN_REVIEW.md`) per scene, plus the one 15-dimension scoring pass per project.

**Output:** a screenshot set under `verification/SCREENSHOTS/`, one annotated pass/fail note per chapter per breakpoint.
**Failure condition:** marking this skill "done" without opening every image — a self-reported pass based on code review alone is not evidence.
**Recovery:** If a chapter's screenshots look wrong, send it back to creative-director/motion-engineer with the specific image and breakpoint, not a vague 'make it better' -- re-run this skill only after they report a fix, never approve speculatively.
