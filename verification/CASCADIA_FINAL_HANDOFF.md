# CASCADIA Final Handoff

Companion to `verification/CASCADIA_FINAL_ACCEPTANCE_REPORT.md` (read that first for the full
evidence and conclusion). This document is the short, practical "what to do next" reference.

## State at handoff

- **Commit:** `594d63c158ea1232347d9586b53e4ee1837eec07` on `main`.
- **Conclusion:** ACCEPTED as a release candidate; deployment explicitly not evidenced (not
  authorized this session).
- **Build:** `npm run build && npm run preview` verified clean, production bundle, this exact commit.
- **Tests:** tsc clean, lint 0 errors, Vitest 61/61, pytest 32/32, Playwright 123/123 (incl. axe-core
  6/6, zero violations).

## To deploy

1. Read `DEPLOYMENT.md` in full.
2. Decide the real target path (root domain vs. project page) and set `vite.config.ts`'s `base`
   accordingly.
3. `npm run build && npm run preview`, re-verify locally.
4. Get explicit authorization to publish externally (standing project rule, not yet given).
5. Deploy, then `curl` the live URL and take a real screenshot of it loading, this project's own
   standing rule is that a deployment isn't verified until checked this way.
6. Update `specifications/REQUIREMENTS.yaml`'s `CAS-RELEASE-001` row and `execution/PROGRESS.md`.

## If resuming other work

- `execution/PROGRESS.md` is the full chronological log (now long, search for "Resume point" for the
  latest summary, or read the last ~150 lines).
- `LIMITATIONS.md` is the current, accurate list of every deliberate scope decision and known gap
  check it before assuming something is a bug.
- `specifications/REQUIREMENTS.yaml` is the requirement-level source of truth; every row has
  `evidence_paths`.
- This session's own remediation history (5+ fix passes, 3 independent reviewer passes) is detailed in
  the acceptance report's §4, worth reading before touching chapter 6's CSS or the intro/nav chrome
  again, since several non-obvious CSS interactions (double-padding stacking, `position:fixed`
  escaping its intended containing block, sticky-range-zero-by-construction) were found there the hard
  way.

## What was NOT done this session (explicitly out of scope, not forgotten)

- Deployment (needs authorization).
- GitHub repo publication / portfolio case-study integration (part of the parent 10-site portfolio
  directive, not this session's scope).
- `CAS-DATA-001`'s one open TODO: the underlying UW/IEEE benchmark's own license text was not located
  (pandapower's own license IS confirmed, BSD-3), flagged honestly in `DATA_CONTRACT.yaml` rather than
  assumed.
- Mobile bottom-sheet control pattern (chapters 2/3/5/6) and portrait-specific layouts for chapters 2-5
  - both documented, deliberate scope decisions in `LIMITATIONS.md`, not defects.
