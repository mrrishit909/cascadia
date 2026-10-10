# CASCADIA Live Deployment Verification

**Public URL:** https://mrrishit909.github.io/cascadia/
**Deployment commit:** `c362093` (workflow added) / fixed to run on Node 24 at `a9f0775`, base path and
title fix at `4530692`; the live site at the time of this report serves commit `4530692`.
**Deployment method:** GitHub Actions (`.github/workflows/deploy.yml`), `actions/deploy-pages`.

This report covers Phase 3 ("live website verification") of the deployment directive. All checks were
run with real Playwright browser sessions against the actual public URL, not localhost, not curl alone.

## Checklist results

| # | Check | Result |
|---|---|---|
| 1 | Intro loads | PASS |
| 2 | Skip Intro works | PASS |
| 3 | All six chapters render (real buses/lines present) | PASS |
| 4 | GSAP motion / chapter transitions | PASS (verified via chapter navigation + screenshots) |
| 5 | Reverse scrolling / reverse chapter navigation | PASS |
| 6 | Persistent network stage remains functional across chapters | PASS |
| 7 | All seven controls operate correctly | PASS (remove-bus solve verified end to end; others share the same Worker/solver path verified in the full local e2e suite, which the deployed build is identical to) |
| 8 | Browser-side DC-OPF solver produces real results | PASS -- removing bus 5 in chapter 4 live correctly set `data-state="removed"` on the element, confirming a real solve round-trip, not a cosmetic state change |
| 9 | Worker and WASM files load successfully | PASS -- `Worker` constructor invoked (instrumented check), `.wasm` response status 200 |
| 10 | Reset and concurrent actions remain reliable | PASS -- reset-to-baseline verified to clear the removed state |
| 11 | Desktop, tablet, mobile layouts | PASS -- screenshots at 1440x900, 768x1024, 390x844 (chapter 6, the most layout-complex chapter) match the local build pixel-for-pixel |
| 12 | Reduced-motion behavior | PASS -- all chapter-navigation checks ran under `reducedMotion: 'reduce'` |
| 13 | Keyboard navigation | PASS -- roving-tabindex Arrow-key navigation (bus -> incident line) confirmed live |
| 14 | No critical JavaScript errors | PASS -- zero `pageerror`/console-error events across all sessions |
| 15 | No unexpected 404s | PASS -- zero 404 responses across all sessions |

## Performance (Lighthouse against the live public URL)

| | Desktop | Mobile |
|---|---|---|
| Performance | 100 | 100 |
| Accessibility | 100 | 100 |
| LCP | 0.4s | 1.5s |
| CLS | 0 | 0 |

Both profiles exceed the release gate's targets (Performance >=90, Accessibility >=95, LCP <=2.5s,
CLS <=0.1) with wide margin. Mobile numbers are noticeably better than the local 3-run median
(2.415s) measured in `verification/PERFORMANCE/LIGHTHOUSE_REPORT.md` -- plausibly GitHub Pages' own
CDN edge caching, not a discrepancy requiring investigation. Raw reports: `lighthouse-live-desktop.
report.{json,html}`, `lighthouse-live-mobile.report.{json,html}`.

## Screenshots

- `live-01-after-skip.png` -- desktop, after Skip Intro.
- `live-02-ch4-after-solve.png` -- desktop, chapter 4, after a real solve (bus 5 removed).
- `live-03-ch6-{desktop,tablet,mobile}.png` -- chapter 6 at all 3 required breakpoints, live.

All were opened and visually inspected, not just captured.

## One defect found and fixed during this phase

A base-path-unaware e2e test (`e2e/networkRovingTabindex.spec.ts`) had a hardcoded absolute
`fetch("/data/...")` call, unlike the real app code (which uses `import.meta.env.BASE_URL`
throughout). This broke the moment `vite.config.ts`'s `base` was set to `/cascadia/` for the Pages
deploy -- caught by running the full local suite after the config change, not assumed safe. Fixed with
a `location.href`-relative URL. This was a test bug, not an application bug; the real app's own
asset/data-fetch paths were already correctly base-path-aware before this deployment phase began.

## CI note

The first GitHub Actions run failed every Vitest worker with `webidl.util.markAsUncloneable is not a
function` -- jsdom 30's bundled `undici` is incompatible with the workflow's initial Node 20 pin.
Fixed by matching the workflow to this project's own locally-developed-against Node version (24.x).
