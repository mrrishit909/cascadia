# Full-experience production frame-pacing measurement (2026-10-10)

Measured against the real production build (`npm run build && npm run preview`, never a dev server),
glow ON throughout, across the WHOLE intro + 6-chapter journey -- this is the integrated pass
ART_DIRECTION.md section 4 and the finalization directive both call for, distinct from and in addition
to chapter 3's own earlier isolated measurement (`CH3_FRAMEPACING_REPORT.md`, kept as-is, not
superseded).

Method: `verification/PERFORMANCE/measure_full_suite_framepacing.mjs`. Every scenario is driven by an
in-page `requestAnimationFrame` loop (the chapter 3 report's own finding carried forward: per-step
Node<->browser round trips read as jitter indistinguishable from real app cost; this script evaluates
each driver function entirely inside the page). Raw numbers: `full_suite_framepacing_2026-10-10.json`.

## Scenarios measured

| Scenario | Viewport | Throttle | p50 | p95 | max | Kill criterion | Result |
|---|---|---|---|---|---|---|---|
| Idle baseline | 1440x900 | none | 16.7 | 17.3 | 17.9 | <=16.7ms | marginal fail (+0.6ms) |
| Forward scroll, full journey (intro->ch6) | 1440x900 | none | 16.7 | 17.3 | 18.0 | <=16.7ms | marginal fail (+0.6ms) |
| Reverse scroll, full journey | 1440x900 | none | 16.6 | 17.5 | 18.5 | <=16.7ms | marginal fail (+0.8ms) |
| Rapid navigation (FIG-index-style jumps) | 1440x900 | none | 16.7 | 17.4 | 18.5 | <=16.7ms | marginal fail (+0.7ms) |
| Chapter 3 corridor morph, integrated | 1440x900 | none | 16.6 | 17.7 | 18.3 | <=16.7ms | marginal fail (+1.0ms) |
| Chapter 3 corridor morph, integrated | 390x844 | 4x CPU | 16.7 | 18.0 | 21.4 | <=33.3ms | **pass** |
| Chapter 4 single-shot fracture tween | 1440x900 | none | 16.7 | 17.4 | 17.9 | <=16.7ms | marginal fail (+0.7ms) |
| Chapter 4 single-shot fracture tween | 390x844 | 4x CPU | 16.7 | 17.6 | 17.9 | <=33.3ms | **pass** |
| Chapter 6 solving feedback (real 1.2s WASM delay) | 1440x900 | none | 16.7 | 17.3 | 17.5 | <=16.7ms | marginal fail (+0.6ms) |
| Chapter 6 solving feedback | 390x844 | 4x CPU | 16.8 | 17.6 | 25.4 | <=33.3ms | **pass** |
| Live solver update DURING chapter 4 scroll (combined worst case) | 1440x900 | none | 16.7 | 17.6 | 19.3 | <=16.7ms | marginal fail (+0.9ms) |

## The desktop "failure," isolated and explained

Every desktop (unthrottled) scenario clusters tightly in a **0.4ms band** (p95 17.3-17.7ms) regardless
of what's actually happening -- an idle page and the most demanding combined scenario tested (a live
Worker solve firing while chapter 4's single-shot tween and a scroll are all in flight at once) differ
by only 0.3ms. That tight a clustering across radically different workloads is itself evidence the
measured number isn't tracking application work.

Confirmed directly, not inferred: the identical sampling loop was run against `about:blank` -- a blank
page with **zero application code of any kind** -- in the same browser/environment:

```
about:blank, zero app code: p50 16.7ms, p95 17.4ms, max 17.7ms
```

This is statistically indistinguishable from every single CASCADIA scenario measured above, including
true idle. **This conclusively demonstrates that the ~17.3-17.7ms desktop p95 floor is a property of
this sandboxed Chromium instance's own render-timing/vsync scheduling (Chromium 156.0.8078.4, headless,
no real display compositor), not CASCADIA's code.** No amount of application-side optimization can
close a gap that exists identically on a page with nothing on it.

## Verdict

**Does not trigger the escalation ladder.** The ladder (fade glow during transforms -> Canvas 2D
underlay -> WebGL) exists to address real, data-driven frame cost; applying it here would not change
the measured numbers at all, since the floor is environmental, not caused by glow filters, geometry
measurement, or any other CASCADIA-specific work -- confirmed by the about:blank control showing the
identical floor with none of those present.

**The mobile/4x-CPU-throttled profile -- ART_DIRECTION.md's own stated primary target ("the stated
mobile device or a 4x-throttled profile")** -- passes every single integrated scenario tested, including
the heaviest ones (chapter 3's corridor morph, chapter 4's fracture, chapter 6's solving feedback),
with real margin (worst case 25.4ms max against a 33.3ms criterion). This is the evidence that matters
most for real-world device performance; the desktop number is reported honestly as a marginal,
environment-attributable non-pass rather than omitted or silently waived.

**Recommendation:** re-run this exact script (`measure_full_suite_framepacing.mjs`) in a non-sandboxed
environment with real display compositing (a developer's own machine, or a CI runner with hardware
acceleration) if a definitive desktop p95 number is required for the release record; the about:blank
control here is strong enough evidence to not block this release on it, but it is not a substitute for
a measurement taken somewhere the 16.67ms vsync floor is actually achievable.
