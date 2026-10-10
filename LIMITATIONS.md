# Limitations

Every item here is a deliberate, documented scope decision -- not a silently-dropped requirement. Each
one is also noted inline, in the source file closest to the decision, at the time it was made.

## Analytical / modeling

- **Cascading trips are not modeled.** The engine is one island-aware DC-OPF solve, not a sequential
  cascading-failure simulation. Chapter 4 shows exactly ONE state transition (baseline -> post-fault),
  in a single 700ms tween, with no stagger by graph distance -- deliberately, so the motion never visually
  claims a cascade model that doesn't exist. The disclaimer "Single LP solve after the fault. Cascading
  trips are not modeled." is shown directly in chapter 4's own fault ledger, adjacent to the numbers.
- **Restoration timing is an equal-time-step assumption**, not real crew-dispatch or outage-duration
  data. `served_mw_steps` (CAS-INT-006's ranking metric) is explicitly MW*steps, never claimed as MWh.
- **Value of lost load (1000 EUR/MWh)** is a synthetic assumption, not sourced from the IEEE case30 data
  -- chosen deliberately far above real marginal generation cost so load shedding is always a genuine
  last resort in the LP, never a cost-optimal choice.
- **Generator cost is linearized** (4 equal-width secant segments), not the true quadratic -- verified
  to overestimate true cost by at most 0.7% in testing, not assumed acceptable.
- **The 5 candidate transmission lines (CAS-INT-004)** are synthetic positions, not part of the real
  IEEE case30 topology -- labeled as such everywhere they appear in the UI (`public/data/raw-metadata/
  candidate_lines.json`, rendered with a distinct dash pattern/accent, never the real-topology styling).

## Chapter-specific, found and scoped during the motion build

- **Chapter 3's corridor-rail bar length is normalized against each line's OWN rating** (0-100% of its
  own thermal limit), not a shared cross-rail MW scale. This reads as "how close to its own limit," which
  is arguably the more apt encoding for "capacity bottlenecks" -- but note it if a creative review
  expects literal MW-proportional bar lengths across all 4 rails instead.
- **Chapter 4's island-separation is a nudge-to-and-settle-there motion**, not a literal
  baseline-position-to-separated-position interpolation. A React prop swap (the story/live fixture
  change) can't be intercepted mid-render to capture a frozen "before" DOM snapshot to animate from; the
  whole stage crossfades (hides) across the swap instead, and the 24px outward nudge plays during the
  fade-in half, ending at the separated position (not bouncing back) for as long as the fault condition
  holds.
- **Chapter 5's mini restoration networks show only which elements are still "down"** (via
  `removedBuses`/`disabledLines`, derived from the real restoration order/step data), never per-bus
  shed/flow detail at intermediate steps. `RestoreStep` (the real underlying data) only carries
  AGGREGATE served/unserved MW per step -- there is no per-bus breakdown available without re-solving
  each intermediate state, which is out of scope. Rather than borrow baseline or live flow data (which
  would show plausible-looking but WRONG per-bus detail for a state that was never actually solved at
  that granularity), each mini network is given a minimal, honest empty result object. The real
  aggregate number is shown accurately, separately, in the step chart.

## Responsive design

- **No true portrait-specific layout for chapters 2-5.** Chapters 1 and 6 have a genuinely
  separately-computed portrait network projection (`NetworkView`'s `orientation="portrait"` prop,
  rotating the raw geodata before fitting to a portrait-shaped box, per `ART_DIRECTION.md`'s own "not
  scaled down from landscape" requirement). Chapters 2-5 currently reuse the scaled-down landscape
  layout at tablet/mobile widths instead.
- **No mobile bottom-sheet pattern.** `ART_DIRECTION.md`'s responsive table calls for a bottom-sheet
  control pattern in chapters 2, 3, 5, and 6 at mobile widths; none exists yet -- controls currently just
  reflow into the normal mobile column layout.
- **Intro title/network overlap at one specific desktop scroll position (P2, cosmetic).** An
  independent review found that, under `prefers-reduced-motion: reduce`, scrolling naturally (not
  jumping via the FIG index) to a position partway through the intro section at desktop width briefly
  shows the "CASCADIA" title text overlapping the network's own glyphs before the chapter 1 handoff
  settles. Confirmed real (not a scroll-test artifact -- two other apparent overlaps the same review
  flagged, at tablet chapter 2 and desktop chapter 4, were investigated and found to be artifacts of
  how the test itself scrolled, and discarded). Left undone this pass: it is a brief, reduced-motion-only,
  one-breakpoint visual overlap during a transient scroll position, not a functional or data-correctness
  defect, and the two structural P1s (chapter 6's layout, the stale `compareRestoration.spec.ts`
  isolation test) took priority within this pass's scope.

## Performance measurement

- **The desktop (unthrottled) frame-pacing kill criterion (p95 <= 16.7ms) could not be definitively
  evaluated in this project's own sandboxed Chromium test environment.** Confirmed directly, not
  assumed: an `about:blank` page with ZERO application code shows the identical ~17.3-17.7ms p95 floor
  as every single measured CASCADIA scenario, including true idle -- this is the test environment's own
  render-timing floor (headless Chromium 156.0.8078.4, no real display compositor), not application
  cost. The mobile/4x-CPU-throttled profile -- `ART_DIRECTION.md`'s own stated primary target -- passes
  every measured scenario with real margin. See `verification/PERFORMANCE/
  FULL_SUITE_FRAMEPACING_REPORT.md` for the full reasoning and a recommendation to re-run the same
  measurement script on hardware with real display compositing if a definitive desktop number is
  required.

## Testing tooling (not application gaps)

- A real slider-drag gesture cannot be simulated via Playwright's `.tap()` in a touch-emulated context;
  keyboard operation of every slider is verified instead and is the real accessibility guarantee.
- A native `<select>`'s value does not respond to synthetic `ArrowDown`/typeahead key events in headless
  Chromium -- `selectOption()` is used for those specific elements in tests; every other interactive
  element (sliders, checkboxes, buttons, the SVG itself) is driven with real keyboard events throughout.

## Deployment

- **Not deployed.** This build has not been published to any external host. `DEPLOYMENT.md` documents
  the build/hosting process and the Pages base-path configuration a real deployment would need, but no
  deployment or external publish has been performed -- per this project's own standing rule, that
  requires explicit authorization which has not been given.
