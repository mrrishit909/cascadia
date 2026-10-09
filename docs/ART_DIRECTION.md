# CASCADIA: Art-Direction Board (M1)

Owner: creative-director. Date: 2026-10-09. Tokens: `specifications/DESIGN_SYSTEM.json`.
Inputs read: `~/creative-engineering/docs/projects/PROJECT_01.md`, `IMPLEMENTATION_PLAN.md` sections 4-5,
`docs/extracted/DESIGN_PRINCIPLES.md`, `docs/extracted/MOTION_REQUIREMENTS.md`.

**Brief in one line.** A luminous electrical organism (the IEEE case30 network) physically fractures,
reroutes and reconstructs under computed flow constraints. It is drawn as an engraved technical plate:
near-black ink `#080D13`, low-bloom copper conductors `#EF9C54`, cool diagnostic blue `#6FA9BE`,
condensed technical sans, asymmetric editorial grid.

**Governing idea: the plate, not the dashboard.** Every chapter is a figure on one continuous
engraved plate. It has a framed legend (cartouche), figure numbers (FIG. 01 to FIG. 06), fine line
work and a single warm metal (copper) that lights up only where the solver says power flows. There
are no cards, gauges-as-decoration or ambient glow. Light is information: copper glows only on
energized lines, and the glow is gone wherever the LP says nothing flows.

---

## 1. References (5, link-only: no images copied into this repo)

| # | Reference | Attribution | License / status | What we take |
|---|---|---|---|---|
| R1 | Santiago Ramon y Cajal, "Purkinje cells (A) and granule cells (B) from pigeon cerebellum" (1899) | Ramon y Cajal; Instituto Cajal, Madrid. Wikimedia Commons: https://commons.wikimedia.org/wiki/File:PurkinjeCell.jpg | Public domain (author d. 1934; Commons states US PD as published before 1931; tagged PD Mark 1.0). We reuse none. | The "organism": branching conductive bodies as ink line on a void, and node bodies whose form shows connectivity. Also detail insets drawn at higher magnification beside the whole. |
| R2 | Nikola Tesla, US Patent 381,968 "Electro-Magnetic Motor" (1888), drawing sheets | Google Patents: https://patents.google.com/patent/US381968 | Public domain (US patent, granted 1888-05-01) | Engraved technical line, figure numbering ("Fig. 1", "Sheet 1"), lettered callouts, hatching to mean material, rotor/coil glyph conventions. |
| R3 | Charles Joseph Minard, "Carte figurative des pertes successives en hommes de l'Armee Francaise dans la campagne de Russie 1812-1813" (1869) | Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Minard.png | Public domain (Commons; PD Mark 1.0) | Flow width as the quantity itself. One warm and one cool band for two states of the same flow. Typeset annotation lying directly on the drawing. |
| R4 | Harold N. Fisk, "Geological Investigation of the Alluvial Valley of the Lower Mississippi River", meander-belt plates (1944, US Army Corps of Engineers, for the Mississippi River Commission) | Public Domain Review: https://publicdomainreview.org/collection/maps-of-the-lower-mississippi-harold-fisk/ (it cites the USACE LMV mapping archive as its source; that archive was not independently fetched) | Public domain as hosted by Public Domain Review (US federal work, 17 U.S.C. 105) | Several alternative states of one system drawn on the same base geometry, told apart by a small set of colors and line styles. This is the model for "recovery plans" comparison. Also map sheets as a navigable series. |
| R5 | Open Infrastructure Map (power layer) | Open Infrastructure Map contributors. https://openinframap.org ; code https://github.com/openinframap/openinframap | Code BSD-3-Clause (GitHub); map data (c) OpenStreetMap contributors under ODbL. Reference only: we use none of its code, styles or data. | A modern grid-domain proof that transmission lines can be read on a dark ground. Line weight and color by voltage class, labels that appear by zoom level, and substations as small precise glyphs instead of icons. |

### Written extraction (per DESIGN_PRINCIPLES p.80)

**Composition.**
- R1 and R4 both put a single dense structure in a large field of controlled negative space. The structure sits off-center, and the white (here, ink) field is part of the composition.
- R2 sets small, rigorously aligned callouts and a figure number against a large drawing. That gives us the asymmetric editorial grid: the network takes an uneven share (7/12, 8/12 or full bleed) and text sits in a narrow column or framed plate. Splits are never 6/6.
- From R3: annotation lives on the drawing, so key MW labels sit next to the line they describe, not in a remote table.

**Typography.**
- R2's lettering is narrow, upright, uniform-stroke and uppercase for callouts. Archivo at 62-75% width (see section 2) is the modern equivalent.
- Legend and labels are uppercase at 75% width with +0.06 to 0.08em tracking.
- Prose runs at 87.5% width in sentence case, so long reading stays comfortable.
- Display titles run at 62% width, uppercase, set tight.
- From R3: numbers are first-class typography. The headline MW result is the largest type on screen after the chapter title.

**Camera.**
- None of the print references move a camera. That is the point. They are orthographic plan views, and the camera follows them: a 2D SVG `viewBox` that only pans and zooms. There is no rotation, perspective or orbit.
- From R1 (Cajal's magnified insets beside the whole specimen): when we zoom (chapter 3, lab selection), a locator inset of the whole network stays visible, so the viewer never loses the whole.
- From R5 (zoom-dependent labels): label density depends on zoom. Wide shots show bus numbers only at generator buses, and close shots label every element.

**Materials.**
- Ink: flat `#080D13`, never gradient.
- Engraving: 1px hairlines, a double-rule plate frame, a faint construction graticule `#16212C`, and 45 degree hatching for "isolated" load (R2 hatching means material, ours means "no generation here").
- Copper: the only metal. It glows with a tight halo of 6px at most, and only where the LP says current flows (low bloom, a deliberate contrast to neon dashboards).
- Diagnostic blue: cold and matte, never glowing. It is reserved for what is NOT served.
- From R3: the warm band is what got through and the cool band is what was lost.

**Navigation.**
- From R2 and R4 (numbered figures and map sheets as a series): chapters are a numbered plate index, FIG. 01 to FIG. 06, in a slim left rail on desktop/tablet and a top strip on mobile.
- Index items are real anchor links: tabbable, `aria-current="step"`, and they work without scrolling through intermediate chapters.
- Scroll drives chapter state but never captures the scroll wheel. Native scroll, keyboard (Tab, PageDown, Space, Home/End) and the index all reach every chapter.
- Within a chapter, the network has roving-tabindex keyboard navigation: Arrow keys move along topology neighbors.

---

## 2. Typeface decision (resolves IMPLEMENTATION_PLAN open decision #1)

**Archivo (variable), by Omnibus-Type, SIL Open Font License 1.1.**
- Source: npm `@fontsource-variable/archivo` (5.3.0 verified on jsDelivr), imported as `import '@fontsource-variable/archivo/wdth.css';`. CSS family `'Archivo Variable'`.
- Axes: `wdth` 62 to 125 (via `font-stretch`), `wght` 100 to 900. The project uses `font-stretch` 62% to 87.5% and weights 400 to 750.
- One latin file: `archivo-latin-wdth-normal.woff2`, about 88 KB.

Why this one:
- It is a grotesk built for technical, high-density use, and its width axis reaches a true condensed (62%). A single file therefore serves the condensed display titles, the 75% technical legend and the 87.5% semi-condensed reading text. That gives one consistent voice with one network request, which suits the LCP target.
- Static condensed families (IBM Plex Sans Condensed, Barlow Condensed) would need either several weight files or a second family for body text.
- Sofia Sans Condensed has no width axis.
- Barlow's rounded terminals read softer than engraved line work.

**Open verification (M2, frontend):**
- Tabular figures are not confirmed by any source I could reach.
- Test: render `1111.1 MW` above `8888.8 MW` with `font-variant-numeric: tabular-nums` and check that the advance widths are equal in a production screenshot.
- If it fails: right-align numeric readouts in fixed-width cells with the unit in a separate span. Do not add a second family without creative review.
- Must use `wdth.css`. The default and `wght.css` imports have no width axis.

---

## 3. Chapter composition archetypes

No two adjacent chapters share an archetype. The two archetypes used twice (editorial split in
2 and 4, immersive canvas in 1 and 6) are non-adjacent. Each repeat also has a differentiator that
can be checked in a screenshot. The network appears in every chapter, so it is the main repetition
risk. Chapters are therefore separated mainly by **network scale, position and form**, not by
color.

| Ch | Name | Archetype | Network share and position (desktop 1440x900, screenshot-checkable) | Control(s) hosted |
|---|---|---|---|---|
| 1 | Grid formation | **Immersive canvas** | Whole network, bbox at least 80% of viewport width, full bleed. Only other element: the legend plate (cols 1-4, bottom, under 20% of area). | none (establishing shot) |
| 2 | demand and generation | **Editorial split, prose-led** | Prose column cols 1-5 (bodyLg, 62ch). Network cols 6-12, about 55% width, at about 60% of chapter 1's scale. A generation/demand balance rule spans the prose column. | CAS-INT-002, CAS-INT-003 |
| 3 | capacity bottlenecks | **Focused inspector** | Network shrinks to a locator inset of 20% at most (cols 1-3, top). The main view (cols 4-12) is a **corridor strip**: rails morph out of the network into straight horizontal rails, each showing a flow bar against a rating tick. There is no large network in this chapter at all. | CAS-INT-005 |
| 4 | outage cascades | **Editorial split, canvas-led, mirrored** | Network **left**, cols 1-8, about 65%, the side opposite chapter 2. Islands are visibly separated by gaps. A **fault ledger** sits right in cols 9-12: removed element, island count, isolated MW, economically shed MW, objective change. The disclaimer sits directly under the numbers. Prose is 2 sentences at most. | CAS-INT-001, CAS-INT-007 |
| 5 | recovery plans | **Comparative view** | Three equal columns (small multiples), one per restoration sequence from the fixture. Each column has a mini network plus a served-MW step chart on a **shared y-axis**, and the columns are ranked by served energy. No single network dominates. A step control advances all three in sync. | CAS-INT-006 |
| 6 | scenario laboratory | **Immersive canvas with anchored inspector** | Full-bleed network at chapter 1 scale, plus a fixed 384px inspector rail on the right holding all controls and readouts. It differs from chapter 1 by the permanent rail, visible controls and an active status region. | all 7 |

**Chapter 3 rail set:**
- The rails are fixed: the baseline fixture's 4 most-loaded lines (by |flow| / rating), plus a 5th "INSPECTED" rail for whatever line the user picks.
- A line that is not a rail can be reached by clicking it or keyboard-focusing it in the locator inset, which acts as a small roving-tabindex network, or through a plain line list under the rails.
- After each CAS-INT-005 solve, the rails keep their order. Any non-rail line that becomes binding is listed under the rails as "ALSO AT LIMIT: line i-j", a button that loads it into the INSPECTED rail.
- Keeping the order fixed stops the comparison from reshuffling under the user's hands.

**Why chapter 4 is a split and not a second immersive canvas.**
- The planning draft made it immersive and flagged the risk that it would look like chapter 1 with gray lines.
- I chose the split for three reasons:
  1. The dossier requires the scientific disclaimer **adjacent to results**, and a ledger column gives it a natural, permanent home beside the numbers.
  2. Isolated load and economically shed load must be labeled differently, and a ledger can do that more legibly than labels on the canvas.
  3. Mirroring chapter 2's split (network left instead of right, numbers instead of prose) keeps the two splits unmistakably different.
- The fracture itself stays large (65% of the viewport). It is the chapter's one consequential change.

**Chapter 4 single-shot rule (load-bearing).**
- The engine is one island-aware DC-OPF solve, not a cascading-trip model. Chapter 4 therefore shows exactly **one state transition**: baseline, then the post-fault solution.
- Every affected element changes in the same 700ms tween. There is no stagger by graph distance, no darkness spreading node to node and no sequential trips, because any of those would visually claim a cascade model we do not have.
- The label "Single LP solve after the fault. Cascading trips are not modeled." sits in the ledger, and the same limitation goes in `LIMITATIONS.md`.

### Responsive compositions (deliberate, not reflow)

| Ch | Tablet 768x1024 | Mobile 390x844 (also verify 360x800) |
|---|---|---|
| 1 | Full-bleed network re-projected to portrait. The layout coordinates get a separate portrait variant and are not scaled down from landscape. Legend plate cols 1-5, bottom. | Portrait network fills 70vh. The legend plate moves to the top under the FIG strip. The network has no labels beyond generator buses. |
| 2 | Network on top (55vh), prose below. The balance rule becomes sticky at the top of the prose. | Stacked: chapter title, balance rule (sticky), 1 short prose block, network strip (45vh), then the control in a bottom-sheet peek. |
| 3 | Locator inset top-left (160px). The corridor rails are full width, stacked, with 2-column gauge readouts. | The locator becomes a 96px thumbnail top-right, rails become a vertical list (one per row) and the capacity slider sits in the bottom sheet. |
| 4 | Network top 60vh, the ledger as a 2-column grid below with the disclaimer directly beneath it. | Network 55vh. The ledger follows as a single-column table, with the disclaimer immediately after the headline number and not at the page bottom. |
| 5 | Three sequences as **rows** sharing one x-axis (restoration step), with one shared mini network on top that highlights the selected sequence. | Same rows layout, one sequence expanded at a time (accordion with real buttons). The step control lives in the bottom sheet. No horizontal swiping or pinning. |
| 6 | Canvas on top (60vh), inspector **stacked** below (dossier: "stacked inspector"). | Canvas full screen with a **bottom sheet** for controls (96px peek / 50vh / 88vh), targets of at least 44px and no hover-only affordances (dossier: "touch-first bottom-sheet controls"). |

---

## 4. Motion sheet contribution

### The 8 "select effects" (MOTION_REQUIREMENTS p.69): verdicts

| Effect | Verdict | Where / why |
|---|---|---|
| Masked text reveal | **SELECT** | Chapter titles only, 800ms, once per entry, replay on index navigation. Reduced motion: immediate text. |
| Parallax layers | **SKIP** | Parallax would misregister labels against geometry in an engraved plate where every label points at a precise element. The graticule is decorative, and parallaxing it would be decoration for its own sake. |
| 3D tilt / soft spotlight | **SKIP** | There are no "technical object selection cards" in this design, deliberately (pill-card veto). Selection happens on the network itself. |
| Magnetic CTA | **SKIP** | The only hero actions are SKIP INTRO and ENTER LABORATORY. A shifting target hurts precision and adds nothing to the energy story. |
| Horizontal analytical passage | **SKIP** | It is the natural candidate for chapter 5, but comparison is stronger when alternatives are visible **simultaneously** (R4's lesson), and a pin/scrub passage is this project's main scroll-hijacking risk. Chapter 5 uses three side-by-side columns with a button-driven synchronized step control instead. |
| Scroll-bound charts | **SELECT** | Chapter 2: the balance rule morphs between generation stack and demand stack. Chapter 3: network geometry morphs into the corridor strip (rails), with labels held through the morph. Direct index navigation lands in the end state. |
| Scene camera transition | **SELECT (2D viewBox)** | Chapter 2 to 3 zooms into the corridor. In the lab, selecting an element eases the viewBox to frame it (600ms, power2.inOut), with input disabled during the move only. Reduced motion: instant. |
| Loading/success/error feedback | **SELECT** | Mandatory. Worker states: solving, ready, infeasible, error, cancelled. Opacity and transform only, under 300ms, mirrored in `aria-live`. |

### Global motion rules (load-bearing)

1. **No count-up numbers.** Displayed values swap (or cross-fade) when a transition ends and are never interpolated from animation progress. This is the repo's hard rule on `Date.now()`/`Math.random()`/animation progress.
2. **Data drives animation, never the reverse.** Pulse direction is the sign of the LP flow, and pulse speed is proportional to |flow|.
3. **One persistent SVG stage** morphs across intro and all chapters. It is never torn down and replaced (dossier handoff rule).
4. **Every chapter defines entry, exit and reverse.** Reverse scroll plays the inverse tween back to the previous fixture state. Interrupting it (fast scroll, index jump) kills the running tween and snaps to the target chapter's end state.
5. **Reduced motion** swaps every state instantly, replaces pulses with static midpoint arrowheads, and loads the intro's final frame directly.

### Opening storyboard (0-12s), mapped to the stage

| Beat | Visual | Mechanism |
|---|---|---|
| 0-3s blackout, single energized node | Ink field. The title plate is legible from frame 1. One generator bus ring lights copper with its halo. | opacity on the core ring, glow group pre-rendered |
| 3-6s lines assemble | Lines draw outward from that bus in breadth-first order, engraved hairline first and copper fill second. | stroke-dashoffset on unfiltered strokes |
| 6-9s demand currents pulse | Baseline fixture flows: pulses travel along lines, and load chevrons grow to served MW. | dashoffset loop; chevron length set from the fixture (not tweened as a number) |
| 9-12s fault interrupts, controls emerge | One preset line opens with a kerf gap. The network swaps to the post-fault fixture in one 700ms transition. The FIG index, SKIP/ENTER controls and the status region fade in. | single state tween; controls opacity/translate 240ms |

- SKIP INTRO is first in tab order (Enter/Space) and jumps to the beat-4 end frame.
- Scrolling into chapter 1 reverses the fault back to baseline ("formation" is the intact grid).

### Per-chapter motion (trigger, timeline progress, keyframes, easing, sync, reverse, cancel, reduced motion)

| Ch | Trigger | Timeline progress drives | Keyframes | Easing / scrub | Synchronization | Reverse / cancel | Reduced motion |
|---|---|---|---|---|---|---|---|
| 1 | Section enters (ScrollTrigger, no pin) | Nothing (time-based, one-shot) | Fault heals to baseline; title mask reveal | state 480ms power2.out | Legend plate shows baseline values from the first frame | Reverse replays fault; kill on jump | Instant baseline |
| 2 | Section enters, then scrub over the section | Scroll progress 0-1 drives the camera pan and the balance-rule morph (geometry only) | viewBox pans the network to cols 6-12 at 60% scale; balance rule morphs gen to demand | camera 600ms; balance scrub linear | Balance totals are static fixture text, not progress-derived | Scrub is inherently reversible | End state, both stacks shown |
| 3 | Section enters, then scrub | Scroll progress drives the network-to-rails geometry morph only | Rails straighten out of the network; the rest collapses into the locator inset | scrub linear, labels pinned to rails | Rail readouts show fixture values throughout; the locator highlights rail lines | Scrub reversible; jump snaps to rails | Rails shown directly |
| 4 | Section enters (single trigger, not scrub) | Nothing (one 700ms tween) | Baseline to post-fault in ONE tween: kerf opens, islands translate 24px apart, affected lines go to the de-energized dash, ledger numbers swap at the end | fracture power3.out | Ledger and legend swap on tween complete, never mid-tween | Reverse restores baseline in one tween; kill and snap on interrupt | Instant swap |
| 5 | User presses STEP / selects a sequence (not scroll) | Step index (integer, from buttons) | All three columns advance one restoration step together; the step chart extends; reconnected lines re-energize | state 480ms | All three columns share one step index and one timeline | PREVIOUS step button; reset | Instant step |
| 6 | Any control commit, then Worker result | Nothing (result-driven) | Last result dims to 60% while solving, then all changed elements transition together on result | feedback 240ms, state 480ms | Stage, inspector readouts and status region update from the same solved result object | Undo/Reset; newer input cancels pending solve | Instant swap |

### Flagship metaphor: 2D SVG + GSAP vs WebGL (explicit judgment)

**Judgment: I agree with the plan. 2D SVG plus GSAP can deliver the luminous organism, with one
correction about the fallback path.**

Why 2D is right here, not just the default:
- **What makes it an organism is behavior, not depth.** Current visibly choosing new paths after a fault (pulses reversing direction, lines thickening as flow reroutes, islands drifting apart, severed ends retracting) does the work. All of that is stroke, transform and opacity animation, which SVG does well at 30 buses and 41 lines.
- **"Low bloom" is a small, static halo.** One `feGaussianBlur` (stdDeviation 2.5) plus `feColorMatrix` tint, on a glow group that re-renders only when solver state changes, is cheap. High-bloom atmospheric glow would need WebGL post-processing, and it is on our veto list anyway.
- **The engraved aesthetic is natively vector.** Hairlines, dash patterns, hatching and crisp labels at every zoom are where SVG beats a WebGL raster.
- **The mobile 2D fallback is mandatory anyway** (dossier). With SVG as the primary renderer, the fallback is the product rather than a degraded copy, and accessibility (focusable elements, real labels) comes for free.
- **No depth axis carries information** in a 30-bus DC model. 3D would be decorative and fail the "3D only where analytically justified" rule.

Where I disagree with the plan's framing:
- If SVG falls short, the next step is **Canvas 2D, not WebGL/R3F.** The likely failure is the glow filter re-rasterizing while island groups translate in chapter 4 or the lab, not a lack of a third dimension.
- The escalation ladder is:
  1. Fade the glow group out during transforms and restore it after settle.
  2. Move only the bloom to a single Canvas 2D underlay, keeping geometry, labels and hit targets in SVG.
  3. Use WebGL only if Canvas 2D also misses the target.

**Kill criterion (falsifiable, measured at M4/M5 on the production build):**
- Measure rAF frame pacing during the chapter 4 fracture transition and a lab node removal, glow on.
- Reverse the 2D-only decision if either holds:
  - p95 frame time is above 33.3ms on the stated mobile device or a 4x CPU-throttled profile.
  - p95 is above 16.7ms at 1440x900 desktop.
- If it triggers, apply the ladder above in order and re-measure after each step.

---

## 5. Originality ledger

| Component | Status | Notes |
|---|---|---|
| Typeface Archivo | Adapted under license | OFL-1.1, unmodified, self-hosted via Fontsource. Ship the OFL text in the repo/credits. |
| case30 network data | Adapted under license | Loaded via pandapower (BSD-3-Clause), originating from PYPOWER / UW Power Systems Test Case Archive. Full chain in `DATA_CONTRACT.yaml` (data-engineer). |
| GSAP + ScrollTrigger | Adapted under license | GSAP standard "no charge" license. Motion-engineer to confirm current terms at install. |
| Network layout coordinates (landscape and portrait variants) | Built from scratch | Hand-authored or computed once and frozen, versioned with the fixture. |
| Glyph set (bus ring with degree ticks, generator rotor arc, load chevron, shed wedge, isolated hatch, kerf, binding casing, circle-slash, selection brackets) | Built from scratch | Follows generic single-line-diagram conventions; no IEC 60617 artwork copied. Tesla-patent influence is stylistic only. |
| Glow filter, encodings, layouts, plate frame, motion choreography | Built from scratch | Original to this project. |
| References R1-R5 | Inspiration only | Link-only. No image, style file or code from any reference is in this repo. |
| Template leftovers | To delete | `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`, `public/favicon.svg` (replace with an original bus-ring favicon). |

---

## 6. Veto-list self-check (checked against everything in this board and DESIGN_SYSTEM.json)

| Veto | Result | How it is avoided |
|---|---|---|
| Generic glowing background | **0 hits** | Background is flat `#080D13`, and gradients/background glow are listed as forbidden in tokens. Glow exists only on energized copper strokes, bounded to 6px. |
| Repetitive pill cards | **0 hits** | Max radius is 2px. There are no card grids anywhere. Readouts live in one legend plate, one ledger or one inspector per chapter. Chapter 5's three columns are small multiples of real data with a shared axis, not cards. |
| Decorative 3D with no information | **0 hits** | No 3D at all. Escalation goes to Canvas 2D before WebGL, and only on a measured kill criterion. |
| Inaccessible scroll hijacking | **0 hits** | No pinned horizontal passage (skipped explicitly). Scrubbed chapters (2, 3) use unpinned ScrollTrigger over native scroll. The FIG index jumps directly to any chapter by keyboard. Chapter 5 steps are buttons. |
| Fake controls | **0 hits** at design level | Every control in the table above maps to a CAS-INT ID with a Worker LP call or fixture. Disabled states carry visible reasons. The decorative graticule and plate frame are non-interactive and not focusable. QA must re-verify on the build. |

**Accessibility check on my own tokens:**
- Selection and focus on network elements are additive overlays: `#E8E4DC` brackets and rings. They never replace the state stroke, so a selected line still shows whether it is binding, low-flow or de-energized.
- The copper focus ring is used only on HTML chrome, where it sits against ink. Against copper geometry it would be invisible.

---

## 7. Handoff to Frontend / Motion

- **Tokens:** `/Users/rishitmathurrishit/cascadia/specifications/DESIGN_SYSTEM.json`
- **Archetypes:** section 3 table (I / S-prose / F / S-canvas-mirrored / C / I+rail)

**Load-bearing (must not be simplified away):**
1. Distinct network scale/position per chapter as specified in section 3, especially chapter 3's corridor strip (no large network) and chapter 4's mirrored canvas-left split.
2. Chapter 4 as a single transition with no graph-distance stagger, and the single-LP disclaimer adjacent to the ledger numbers.
3. Two-channel state encoding (hue plus width, dash, glyph or label). Isolated vs economically shed load must be visually and textually distinct. Selection and focus are additive and never overwrite state.
4. Glow only on energized lines, driven by solver state, with the legend plate opaque and above all glow.
5. No count-up numbers, and data-driven pulse direction and speed.
6. One persistent SVG stage from intro through chapter 6.
7. Deliberate portrait layout coordinates for tablet/mobile (not scaled landscape) and the mobile bottom sheet.
8. Archivo via `wdth.css` at the specified widths.

**Negotiable (adjust freely if budget requires, tell creative-director):**
- Exact durations within the token ranges, and exact stdDeviation (2 to 3).
- Island separation offset (16 to 32px).
- Degree ticks on bus rings (keep the ring).
- Graticule density.
- Chapter 2 balance-rule morph (a simple cross-fade is acceptable).
- Number of fixed corridor rails in chapter 3 (3 to 5 plus INSPECTED).

**Open verification items:**
- Archivo tnum test (M2).
- Glow frame-pacing kill criterion (M4/M5).
- axe-core contrast confirmation of the hand-computed ratios (M5).
- GSAP license terms at install.
- Chapter screenshots at 1440x900, 768x1024 and 390x844 reviewed by creative-director per chapter before CAS-MOTION-001 is claimed. There is no visual baseline approval yet because nothing is built.
