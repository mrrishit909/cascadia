---
name: creative-direction
description: Produce an original art-direction board and design tokens for one Atlas project, applying the Prompting Playbook's seven layers. Use at project start, owned by the creative-director agent, before any visual implementation.
---

# Creative Direction Generation

**When:** Early in a project, parallel with (not after) dataset verification.
**Input:** the project dossier's visual identity line (3 hex colors + typography/texture description), the 4-beat storyboard, the 6 chapter names.

## Procedure

1. Gather 3-5 attributed visual references (not the Atlas's own text — actual images/sites) that match the dossier's described metaphor. Record what's original vs. adapted-under-license vs. built-from-scratch.
2. Apply the seven-layer prompt structure from `docs/extracted/DESIGN_PRINCIPLES.md` (purpose, audience, visual direction, structure, 3D, motion, constraints) to write the actual creative brief used to drive implementation.
3. Produce `specifications/DESIGN_SYSTEM.json`: hex values, font family + licensed source, type scale, grid, spacing, elevation, component states.
4. For each of the 6 chapters, assign a distinct composition archetype (immersive canvas, editorial split, focused inspector, comparative view) — no two adjacent chapters share one.
5. Veto list check: no generic glowing background, no repetitive pill cards, no decorative 3D with zero information content, no scroll-hijacking that blocks keyboard nav, no fake controls.

**Output:** `specifications/DESIGN_SYSTEM.json` + an art-direction board doc.
**Failure condition:** any chapter composition indistinguishable from another, or a vetoed pattern present.
**Recovery:** If no reference set avoids a vetoed pattern within budget, escalate to the Orchestrator with the tradeoff spelled out rather than shipping a veto-listed pattern anyway.
