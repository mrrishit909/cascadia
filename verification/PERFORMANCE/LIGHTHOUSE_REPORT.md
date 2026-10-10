# Lighthouse measurement

Run against the real production build (`npm run build && npm run preview`, port 4173), Lighthouse
13.5.0, headless Chrome.

This is a separate measurement from `verification/PERFORMANCE/FULL_SUITE_FRAMEPACING_REPORT.md`
(real-device frame-pacing via `requestAnimationFrame` sampling). Lighthouse measures page-load
performance (LCP, CLS, TBT) and static audits (accessibility, best practices), not runtime scroll/
animation frame pacing -- the release gate's "Performance" row requires both, and neither substitutes
for the other.

## History (both rounds are kept on record; the first was wrong)

**Round 1 (commit `6790cc6`)**: measured mobile LCP at 2.567s (single run), over the gate's 2.5s
target. The report at that point claimed an investigation into render-blocking resources and critical
request chains found nothing actionable -- that claim was WRONG: the audit IDs checked
(`render-blocking-resources`, `critical-request-chains`, etc.) don't exist in Lighthouse 13, so the
lookups silently returned `undefined`/threw, and no real investigation had actually happened. Caught by
an advisor review of this report itself, not by a human.

**Round 2 (commit `9dac8a0`, current)**: re-ran the investigation against this Lighthouse version's
real audit IDs (`*-insight` suffixed, e.g. `render-blocking-insight`). That audit flagged the app's
single ~4KB CSS bundle as render-blocking, estimating ~750ms of LCP/FCP savings if removed from the
critical path -- more than enough to explain the round-1 miss. Fixed by inlining the CSS directly into
`index.html` at build time (`vite.config.ts`'s `inlineCss` plugin) rather than loading it as a separate
`<link rel="stylesheet">`. Re-measured: `render-blocking-insight` score is now 1 (clean), and mobile LCP
dropped to a median 2.415s across 3 runs, clear of the gate.

## Desktop (`--preset=desktop`, commit `9dac8a0`)

| Metric | Result | Gate | Status |
|---|---|---|---|
| Performance | 100 | >=90 | PASS |
| Accessibility | 100 | >=95 | PASS |
| LCP | 0.53s | <=2.5s | PASS |
| CLS | 0 | <=0.1 | PASS |

Raw report: `lighthouse/desktop.report.json` / `.html`.

## Mobile (Lighthouse's default mobile preset: simulated slow 4G, 150ms RTT, ~1.6Mbps throughput,
4x CPU slowdown -- the standard Core Web Vitals mobile profile, matching this project's own stated
primary target device class), 3 runs at commit `9dac8a0`

| Run | Performance | Accessibility | LCP | CLS |
|---|---|---|---|---|
| 1 | 96 | 100 | 2.418s | 0 |
| 2 | 96 | 100 | 2.413s | 0 |
| 3 | 96 | 100 | 2.415s | 0 |
| **Median** | **96** | **100** | **2.415s** | **0** |

| Metric | Median | Gate | Status |
|---|---|---|---|
| Performance | 96 | >=90 | PASS |
| Accessibility | 100 | >=95 | PASS |
| LCP | 2.415s | <=2.5s | PASS |
| CLS | 0 | <=0.1 | PASS |

Raw reports: `lighthouse/mobile-run1.report.json`, `mobile-run2.report.json`, `mobile-run3.report.json`.

## Conclusion

Both desktop and mobile now pass every gated metric (Performance, Accessibility, LCP, CLS) with real
margin, confirmed across 3 mobile runs to rule out single-run noise. The round-1 miss and its incorrect
"investigated, no fix available" claim are kept on record above rather than erased, since the actual
fix (CSS inlining) came directly from correctly running that investigation the second time.
