# Visual design

Source of truth: `specifications/DESIGN_SYSTEM.json` (tokens) and `docs/ART_DIRECTION.md` (the full
creative brief, references, and per-chapter composition rules). This file is a summary, not a
replacement -- read those two for anything load-bearing.

## The governing idea

"The plate, not the dashboard." Every chapter is a figure on one continuous engraved technical plate:
near-black ink, low-bloom copper conductors that light up only where the solver says power flows, cool
diagnostic blue for what is NOT served, a condensed technical sans, an asymmetric editorial grid. No
cards, no decorative gauges, no ambient glow -- light is information.

## Palette

| Token | Hex | Use |
|---|---|---|
| Ink | `#080D13` | Background. Flat, never a gradient. |
| Copper | `#EF9C54` | Energized conductors. |
| Copper hot | `#FFD2A1` | Binding (at-limit) lines. |
| Copper dim | `#9C6639` | Low-flow lines. |
| Diagnostic | `#6FA9BE` | Unserved/shed load, secondary data. Never glows. |
| De-energized | `#5E6B78` | Removed/outaged elements. |
| Fault | `#E0645A` | Reserved for infeasible status ONLY -- never reused for "removed" or "binding." |
| Text | `#E8E4DC` / `#9AA5B1` / `#808C99` | Primary / secondary / muted. |

## Type

Archivo Variable (`@fontsource-variable/archivo`, `wdth.css` import, SIL OFL 1.1), one file serving
every weight/width this project uses via its `wdth` (62-125) and `wght` (100-900) axes: condensed
display titles at 62% stretch, uppercase legend/label text at 75%, semi-condensed body prose at 87.5%.
Tabular numerals throughout numeric readouts.

## Glow

One SVG `feGaussianBlur` + `feColorMatrix` filter, applied only to energized-line strokes, capped at a
6px halo, re-rendered only when solver state changes. No atmospheric/background glow anywhere --
checked explicitly against the veto list (`ART_DIRECTION.md` section 6) and confirmed zero hits.

## Encoding rules (the two-channel requirement)

Every meaningful state is encoded by at least TWO channels (hue plus width, dash pattern, or a glyph) --
never color alone. Binding lines: copper-hot core with a copper casing (a double rule), not just a
brighter color. Isolated (no-generation) buses: diagnostic-blue fill with a dashed ring, distinct from
economically-shed buses (diagnostic stroke, no dash). Removed elements: a de-energized dash pattern plus
an explicit circle-slash/X glyph, never fault-red (fault red is reserved exclusively for infeasible
status). Selection and focus are ADDITIVE overlays (brackets, a focus ring) that never replace the
underlying state stroke.

## Chapter archetypes (no two adjacent chapters share one)

| Ch | Archetype | What differentiates it |
|---|---|---|
| 1 | Immersive canvas | Full-bleed network, legend plate bottom-left. |
| 2 | Editorial split, prose-led | Network pushed right (~55%), prose + balance rule left. |
| 3 | Focused inspector | Network shrinks to a small locator inset; the main view is a corridor strip of horizontal rails -- no large network at all. |
| 4 | Editorial split, canvas-led, mirrored | Network pushed LEFT (~65%, the opposite side from chapter 2), numbers (a fault ledger) right instead of prose. |
| 5 | Comparative view | No single network dominates -- three equal small-multiple columns. |
| 6 | Immersive canvas + anchored inspector | Full-bleed again, like chapter 1, but with a permanent control rail and live status -- the repeat is deliberate and screenshot-differentiable. |

## Verified against the veto list

Zero hits confirmed for: generic glowing background, repetitive pill cards, decorative 3D, inaccessible
scroll hijacking (no pinned passages; every scrubbed chapter uses unpinned `ScrollTrigger` over native
scroll; the FIG index reaches any chapter directly), and fake controls (every control maps to a real
Worker LP call or a versioned fixture).
