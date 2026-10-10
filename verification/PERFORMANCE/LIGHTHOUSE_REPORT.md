# Lighthouse measurement

Run against the real production build (`npm run build && npm run preview`, port 4173), Lighthouse
13.5.0, headless Chrome, at commit `6790cc6` (the final remediation commit at the time this was run).
Raw reports: `lighthouse/desktop.report.json` / `.html`, `lighthouse/mobile.report.json` / `.html`.

This is a separate measurement from `verification/PERFORMANCE/FULL_SUITE_FRAMEPACING_REPORT.md`
(real-device frame-pacing via `requestAnimationFrame` sampling). Lighthouse measures page-load
performance (LCP, CLS, TBT) and static audits (accessibility, best practices), not runtime scroll/
animation frame pacing -- the release gate's "Performance" row requires both, and neither substitutes
for the other.

## Desktop (`--preset=desktop`)

| Metric | Result | Gate | Status |
|---|---|---|---|
| Performance | 100 | >=90 | PASS |
| Accessibility | 100 | >=95 | PASS |
| Best Practices | 100 | (not gated) | -- |
| SEO | 82 | (not gated) | -- |
| LCP | 0.5s | <=2.5s | PASS |
| CLS | 0 | <=0.1 | PASS |
| TBT | 0ms | (not gated) | -- |

Desktop passes every gated metric with large margin.

## Mobile (Lighthouse's default mobile preset: simulated slow 4G, 150ms RTT, ~1.6Mbps throughput,
4x CPU slowdown -- the standard Core Web Vitals mobile profile, matching this project's own stated
primary target device class)

| Metric | Result | Gate | Status |
|---|---|---|---|
| Performance | 95 | >=90 | PASS |
| Accessibility | 100 | >=95 | PASS |
| Best Practices | 100 | (not gated) | -- |
| SEO | 82 | (not gated) | -- |
| LCP | **2.567s** | <=2.5s | **MARGINAL FAIL (67ms / 2.7% over)** |
| CLS | 0 | <=0.1 | PASS |
| TBT | 20ms | (not gated) | -- |

**This is a real, measured gate miss, reported honestly rather than rounded down or omitted.**

### What was investigated before reporting this as unfixed

- Total transfer weight is small (235 KiB) and `render-blocking-resources`/`critical-request-chains`
  show no render-blocking stylesheets or scripts, no unminified/unused CSS of consequence, and no long
  critical request chain -- there is no obvious render-blocking resource to defer or inline.
- The LCP element Lighthouse identifies is the "SKIP INTRO" button; its own breakdown sub-audit
  (`lcp-breakdown-insight`) attributes under 103ms combined to time-to-first-byte + element render
  delay in the OBSERVED trace -- the simulated 2.567s headline figure is dominated by the throttling
  model's own round-trip-time simulation (150ms RTT applied across the sequential HTML -> CSS/JS
  discovery -> paint chain for a 235 KiB SPA bundle), not an identifiable application-side inefficiency.
- No code change was made to chase this 67ms margin: every candidate fix (resource hints, critical-CSS
  inlining, further bundle-splitting) is speculative against a simulated-network artifact with no
  render-blocking audit actually failing, and this late in verification a speculative layout/loading
  change risks reintroducing exactly the kind of regression the last 4 remediation passes were spent
  catching and fixing. Documented as a known, measured limitation instead.

## Conclusion

Desktop passes the full Performance gate row outright. Mobile passes Performance score, Accessibility,
and CLS, but misses the LCP sub-threshold by a small, real margin under Lighthouse's standard throttled
mobile simulation. This is recorded in `LIMITATIONS.md` and factored into the final acceptance
conclusion -- it is not glossed over to produce an unqualified ACCEPTED result.
