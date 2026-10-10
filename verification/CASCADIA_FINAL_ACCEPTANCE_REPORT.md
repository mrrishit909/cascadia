# CASCADIA Final Acceptance Report

**Commit under evaluation:** `594d63c158ea1232347d9586b53e4ee1837eec07` (branch `main`)
**Build verified:** `npm run build && npm run preview` (production bundle, never a dev server) at this
exact commit, immediately before writing this report.
**Date:** 2026-10-10

This report follows the user's own "CASCADIA, FINAL RELEASE CANDIDATE VERIFICATION" directive: every
number below was freshly re-run at the commit named above, not carried over from an earlier point in
the session. Where an earlier measurement or claim in this session's own history was later found wrong,
that is stated explicitly rather than silently corrected.

---

## 1. Requirement coverage (`specifications/REQUIREMENTS.yaml`)

| ID | Priority | Status |
|---|---|---|
| CAS-INT-001 Remove node | P0 | independently verified |
| CAS-INT-002 Increase load | P0 | implemented |
| CAS-INT-003 Reduce generator | P0 | implemented |
| CAS-INT-004 Add line | P0 | independently verified |
| CAS-INT-005 Alter line capacity | P0 | independently verified |
| CAS-INT-006 Compare restoration | P0 | implemented |
| CAS-INT-007 Line outage | P1 | implemented |
| CAS-DATA-001 Dataset gate | P0 | implemented (license-review TODO open, see note in file) |
| CAS-MATH-001 Oracle correctness | P0 | independently verified |
| CAS-UX-001 Six controls + parity | P0 | implemented |
| CAS-MOTION-001 Intro + 6 chapters | P0 | **independently verified** (updated this session, see §4) |
| CAS-RELEASE-001 Deployment gate | P0 | unstarted (deployment not authorized) |

All 12 rows have a `status` and `evidence_paths`; none claim "independently verified" without an
`verification/*_INDEPENDENT_REVIEW.md` file backing it. Two rows carry known, honestly-stated open
items (CAS-DATA-001's license-text TODO; CAS-INT-005's note on a pre-existing, still-open P2 timing
edge case) rather than being marked clean.

## 2. Full test suite (fresh run, this exact commit)

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | clean, 0 errors |
| `npm run lint` (oxlint) | exit 0, **0 errors**, 28 pre-existing warnings (not touched this session; several are deliberate documented patterns, e.g. `App.tsx`'s ref-during-render camera-reset fix) |
| `npm run test -- --run` (Vitest) | **61/61 passed**, 17 test files |
| `.venv/bin/python -m pytest -q` | **32/32 passed** |
| `npx playwright test` (full suite) | **123/123 passed** |
| `npx playwright test e2e/a11y.spec.ts` (axe-core) | **6/6 passed, zero violations** across baseline + chapters 3/4/5/6 |

No suite was run against a dev server; every e2e test runs against `npm run preview`'s production
build (`playwright.config.ts`'s own `webServer` block enforces this).

## 3. Mathematical / analytical correctness

- Python oracle: 195/195 N-1 sweep cases pass invariants (max per-island balance 2.8e-14 MW);
  pandapower cross-check agrees to 9.6e-13 MW.
- TS Worker vs. Python oracle: 195/195 parity (max relative delta ~8e-15).
- Independent per-bus balance re-derivation (not the engine's own reported field): 198/198, worst
  7.5e-13 MW.
- 40-case load/generator oracle sweep, 24-case add-line/restoration oracle sweep: both parity-verified
  against the TS Worker.
- All of the above independently re-confirmed by a separate adversarial-reviewer session
  (`verification/D1_D2_INDEPENDENT_REVIEW.md`) that re-derived every number itself.

## 4. Independent adversarial review (motion/visual work)

CAS-MOTION-001 previously carried `status: implemented` specifically because its own required
independent adversarial review (per the directive's phase 2) had not yet happened. That review is now
complete, in two passes, each a fresh git worktree with no access to `execution/PROGRESS.md`:

**Review 1** found a real P1 (chapter 6's inspector rail had zero chapter-specific CSS, so its 7
control cards sat transparent in normal document flow, scrolling loose over the network) and confirmed
one test-only staleness (`compareRestoration.spec.ts` missing a chapter-navigation step before a
shared-stage assertion). Both were fixed, with a third, now-stale documentation-only finding needing no
action.

**Remediating review 1's finding took 5 further passes**, because each fix was itself re-checked rather
than trusted:
1. First attempt at the chapter 6 fix used `position: fixed`, which was itself a real regression
   (pinned over the ENTIRE page at every scroll position, breaking 8 unrelated tests in other
   chapters), caught by re-running the full suite, not just chapter 6's own tests.
2. The corrected `position: sticky` fix left a 160px gap from `main`/`.chapter-section`'s stacked
   padding and covered an interactive bus; the test had been loosened to accept this rather than fixed
   - caught by an advisor review of the fix itself, corrected, test restored to strict.
3. A **second fresh-worktree review** (verifying passes 1-2, not trusting them) found the `<1023px`
   reset was missing 2 of 9 desktop-only properties, causing real horizontal overflow and a persistent
   network overlay at tablet/mobile, fixed, with a scroll-sweep regression test (the prior test only
   checked one frame).
4. The same advisor review of the finalization record also caught: the intro title had no opaque
   backing (overlapping network glyphs across a real scroll sweep, initially mischaracterized as "brief/
   transient" without being reproduced), fixed with an opaque title plate; SKIP INTRO overlapping the
   FIG-index nav bar at narrow widths, and the same nav strip causing real horizontal page overflow
   both fixed.
5. A **third fresh-worktree review** (verifying passes 1-4) found one more real defect: a 16px margin
   leak at tablet/mobile letting a sliver of the network remain visible beside the chapter 6 rail for
   its full scroll length (same double-padding bug class, applied this time to `.chapter-section`'s own
   padding vs. `.stage-sticky`'s). Fixed, with a regression test extending the existing scroll-sweep
   check to a horizontal-containment check it previously missed.

A further advisor review of the record itself (not the app) caught two more precision problems,
addressed in the commit before this report:
- Lighthouse's render-blocking audit was never actually consulted (the first attempt checked audit IDs
  that don't exist in this Lighthouse version), rerun correctly, it found the app's CSS bundle
  genuinely render-blocking (~750ms estimated LCP cost), fixed by inlining it into `index.html` at
  build time. See §5.
- `.stage-sticky`'s narrow-width `top: 44px` was a stale guess; the real nav-bar height is 56px,
  corrected.

**A final scoped review** (after the CSS-inlining and nav-offset fixes specifically) found no further
defects: confirmed the inlined CSS renders correctly at all 3 breakpoints for chapters 1 and 6, confirmed
zero gap/overlap between the nav bar and the network stage, and reran the full suite fresh (tsc clean,
Vitest 61/61, Playwright 123/123).

**Every fix across all passes was confirmed to fail against the pre-fix code first** (`git stash` the
fix, rebuild, rerun, confirm red, `git stash pop`, reapply), not written to pass only against the
already-fixed state. Full commit history of this remediation: `98eb5cf` through `594d63c` on `main`.

**One accepted, documented deviation remains**, judged not to warrant a further fix pass: chapter 6's
inspector rail has zero page-scroll sticky range at desktop (the rail is the section's only child and
already `height:100vh`, leaving no containing-block slack for `position:sticky` to pin through), a
positioning-semantics gap against `ART_DIRECTION.md` row 6's "fixed 384px rail" phrasing, not a
reachability one (all 7 controls confirmed reachable via the rail's own independent `overflow-y:auto`
internal scroll). Documented in `LIMITATIONS.md`.

## 5. Performance

**Frame-pacing** (`verification/PERFORMANCE/FULL_SUITE_FRAMEPACING_REPORT.md`): full intro + 6-chapter
journey, forward/reverse scroll, rapid navigation, every chapter's heaviest interaction, and a live
solver update firing during chapter 4's motion. Mobile/4x-CPU-throttled profile (the project's own
stated primary target) passes every scenario with real margin. The desktop (unthrottled) p95<=16.7ms
criterion could not be definitively evaluated in this sandboxed test environment, confirmed via an
`about:blank`-with-zero-app-code control showing the identical ~17.3-17.7ms floor as every real
scenario, i.e. a test-environment limitation, not application cost. Documented honestly in
`LIMITATIONS.md`, not claimed as a pass.

**Lighthouse** (`verification/PERFORMANCE/LIGHTHOUSE_REPORT.md`), re-measured at this report's commit:

| | Desktop | Mobile (median of 3 runs) |
|---|---|---|
| Performance | 100 | 96 |
| Accessibility | 100 | 100 |
| LCP | 0.53s | 2.415s |
| CLS | 0 | 0 |

All gated metrics (Performance >=90, Accessibility >=95, LCP <=2.5s, CLS <=0.1) pass on both profiles,
with real margin on mobile LCP now that the render-blocking CSS is fixed. This report's own history
(§4) documents an earlier incorrect claim about this measurement, corrected before this report was
written, kept on record in `LIGHTHOUSE_REPORT.md` rather than erased.

## 6. Visual / responsive QA

Committed evidence (not evidence that lived only in a temporary job directory): all 6 chapters
screenshotted fresh at this commit, at all 3 required breakpoints (1440x900, 768x1024, 390x844), via
real FIG-index navigation, under reduced motion, `verification/SCREENSHOTS/ch{1-6}-{desktop,tablet,
mobile}-*.png` (18 files, 13 overwriting stale pre-remediation shots, 5 new). A full intro-to-chapter-6
scroll recording (`verification/SCREENSHOTS/scroll-recording/intro-to-ch6.webm`, Playwright
`recordVideo`, reduced motion, 1440x900) provides the interaction-recording evidence this project's own
mandatory visual-QA policy requires alongside static screenshots. All of the above were opened and
visually inspected during this session, not just captured and trusted.

## 7. Known limitations (full list: `LIMITATIONS.md`)

- No cascading-failure model (single LP solve per fault, disclosed in-UI).
- Restoration timing is an equal-time-step assumption, not real outage-duration data.
- Synthetic VOLL assumption; linearized generator cost (<=0.7% overestimate, verified).
- 5 candidate transmission lines are synthetic, labeled as such everywhere shown.
- Chapter 3's rail bars are self-normalized, not a shared cross-rail MW scale.
- Chapter 4's island separation is a crossfade+nudge, not a literal position interpolation.
- Chapter 5's mini networks show only up/down state, not per-bus intermediate flow detail.
- No portrait-specific layout for chapters 2-5 (only 1 and 6 have one).
- No mobile bottom-sheet control pattern (chapters 2/3/5/6).
- Desktop frame-pacing's unthrottled kill criterion could not be definitively evaluated (test
  environment floor, not application cost, see §5).
- Chapter 6's inspector rail has zero page-scroll sticky range at desktop (positioning semantics only,
  not reachability, see §4).
- Testing-tool constraints (not app gaps): synthetic touch-drag and native `<select>` keyboard
  limitations in headless Chromium, both worked around with equivalent real-keyboard coverage.
- **Not deployed.** No external publish has been performed; `DEPLOYMENT.md` documents the exact steps
  (base path, build, verify, curl, screenshot) for whoever is authorized to complete it.

## 8. Deployment readiness

`CAS-RELEASE-001` remains `unstarted`. The production build is verified clean and is the exact build
every test in this report ran against. `vite.config.ts`'s `base` option is deliberately unset pending a
real target-path decision, documented in `DEPLOYMENT.md`. No deployment or external publish has been
performed this session, per this project's own standing rule requiring explicit authorization, which
has not been given.

## 9. Conclusion

**ACCEPTED** as a release candidate, with the deployment row (`CAS-RELEASE-001`) and its 3 gate rows
(Deployment, GitHub repo publication, Portfolio case-study page) explicitly carved out as **not
evidenced** rather than passed, those require actions (authorization, a real GitHub push, portfolio
integration) outside this session's scope and this project's own standing rule against unauthorized
external publishing.

Within that carve-out, every other requirement in `specifications/REQUIREMENTS.yaml` is either
`implemented` or `independently verified` with cited evidence; the full test suite (tsc, lint, Vitest,
pytest, Playwright, axe-core) is green at this exact commit; mathematical correctness is independently
re-derived and verified; the motion/visual work has been through two full independent adversarial
review passes plus a final scoped confirmation, with every finding fixed and re-verified before this
report was written; performance (both frame-pacing and Lighthouse, including the accessibility and
Core Web Vitals gates) passes on its stated primary target (mobile) and with wide margin on desktop;
and every known limitation, including two documented mid-session corrections to this project's own
record (an unverified Lighthouse investigation claim, an overstated "brief/transient" visual defect),
is disclosed honestly in `LIMITATIONS.md` rather than hidden or rounded away.

Next step for deployment: set `vite.config.ts`'s `base` to the real target path, rebuild, verify with
`npm run preview`, obtain explicit authorization to publish, deploy, then `curl` the live URL and
screenshot it per `DEPLOYMENT.md`'s own checklist, none of which this report performs.
