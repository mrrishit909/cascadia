---
name: perf-profiling
description: Measure real Lighthouse/DevTools/Playwright performance numbers on a stated device, never invented targets. Use before Gate G5, owned by qa-engineer.
---

# Performance Profiling

**When:** Before Gate G5, against the production build.
**Input:** the deployed or locally-served production build, a stated test device/browser.

## Procedure

1. Run Lighthouse against the production preview (not dev server). Record actual scores: performance, accessibility, best-practices, SEO are informational; the portfolio's own target is 90+ perf, 95+ a11y.
2. Record actual Core Web Vitals: LCP, CLS, INP, on the stated hardware — never claim a number you didn't measure.
3. Check for a continuous idle render loop (WebGL/canvas rendering every frame with no state change) using the browser's performance profiler — this is the single most common silent performance bug in motion-heavy pages.
4. Measure frame timing during the busiest chapter's animation specifically, not just page load.
5. State clearly which device/browser was actually tested; never announce "universal" performance from one run.

**Output:** a performance report with real numbers, the test device named, and the idle-render-loop check result.
**Failure condition:** a performance claim with no named test device/browser behind it.
**Recovery:** If a budget is missed, profile to find the specific cause (idle render loop, unbounded geometry, unchunked main-thread work) before reporting -- a bare 'performance is bad' without a named cause isn't an actionable finding.
