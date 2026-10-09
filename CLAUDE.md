# CASCADIA

Electrical network resilience project, #1 in the Creative Engineering Atlas. Built from
`~/creative-engineering`'s infrastructure (agents, skills, requirements extraction).

## Before touching this repo

Read, in order:
1. `~/creative-engineering/docs/planning/cascadia/IMPLEMENTATION_PLAN.md` (architecture, resolved decisions)
2. `~/creative-engineering/docs/planning/cascadia/PROTOTYPE_ACCEPTANCE_CRITERIA.md` (what "done" means for the first slice)
3. `specifications/REQUIREMENTS.yaml` (this repo's own 12 requirement rows: 7 interactions + 5 gates)
4. `execution/PROGRESS.md` (current state, resume point)

## Precedence (from the Atlas, p.78)

verified user brief and approved reference images > approved project-specific contract >
`~/creative-engineering/docs/extracted/EXECUTION_PROTOCOL.md` > this project's dossier
(`~/creative-engineering/docs/projects/PROJECT_01.md`) > optional creative inspirations.

## Resolved architecture decisions (do not re-litigate; see IMPLEMENTATION_PLAN.md for why)

- Analytical engine: island-aware DC-OPF linear program (NOT plain DC power flow) -- required by
  the dossier's own high-risk limitation ("islands must not silently draw power").
- Dataset: IEEE case30 (via `pandapower.networks.case30()`), not case14 (broken line ratings).
- Python oracle: `scipy.optimize.linprog` (HiGHS method), independent of pandapower's own solver.
- Browser LP solver: `highs` npm package (MIT, WASM). Never `glpk.js` (GPL).
- Generator costs: piecewise-linearized identically on both sides (not a QP/LP mismatch).
- Visualization: 2D SVG first; WebGL/R3F only if measurement proves 2D insufficient.
- Chapter 4 ("outage cascades"): single-shot LP response, not a cascading-trip model.
- CAS-INT-007 (line outage, P1): approved and in `specifications/REQUIREMENTS.yaml`.
- Motion library: GSAP + ScrollTrigger. License checked directly (web search, 2026): free for commercial
  use since v3.14 (Webflow acquired GSAP, made it free Labor Day 2025), but under Webflow's own
  "Standard No-Charge" license, NOT OSI-approved/MIT -- its one substantive restriction (building a
  visual no-code animation tool that competes with Webflow) does not apply to this project's use
  (animating a data visualization, not building an animation authoring tool), so it's fine here, but
  don't describe it as "MIT" or "open source" in any doc.
- This project is held to BOTH the Atlas's 5-gate system AND the parent 10-site portfolio
  directive's doc-file list and 11-category release gate (user-confirmed).

## Hard rules

- Every one of the 7 required controls must trigger a real computation (Worker LP call or
  matched versioned fixture), never a cosmetic state change.
- Never derive a displayed numeric value from `Date.now()`, `Math.random()`, or animation
  progress.
- Never claim a gate (CAS-DATA-001 through CAS-RELEASE-001) passed without the evidence that
  gate's row in `REQUIREMENTS.yaml` requires.
