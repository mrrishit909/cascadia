# CASCADIA Final Handoff

Companion to `verification/CASCADIA_FINAL_ACCEPTANCE_REPORT.md` (read that first for the full
evidence and conclusion). This document is the short, practical "what to do next" reference.

## State at handoff (updated 2026-10-10: now published)

- **Release-candidate commit:** `594d63c158ea1232347d9586b53e4ee1837eec07` on `main`, tagged
  `release-candidate-594d63c`.
- **Deployed commit:** `47c5c46` on `main` (base path + title fixed at `4530692`, CI fixed at `a9f0775`,
  Actions workflow added at `c362093`).
- **Conclusion:** ACCEPTED and PUBLISHED. Live app, GitHub repo, and portfolio case study are all up
  and independently verified. See `verification/CASCADIA_PUBLICATION_REPORT.md` for the full record.
- **Live URL:** https://mrrishit909.github.io/cascadia/
- **GitHub repo:** https://github.com/mrrishit909/cascadia
- **Portfolio case study:** https://mrrishit909.github.io/projects/cascadia/
- **Build:** `npm run build && npm run preview` verified clean, production bundle, this exact commit.
- **Tests:** tsc clean, lint 0 errors, Vitest 61/61, pytest 32/32, Playwright 123/123 (incl. axe-core
  6/6, zero violations).

## Deployment (done, for reference)

1. `vite.config.ts`'s `base` set to `/cascadia/` (GitHub Pages project page).
2. Pushed to the public `https://github.com/mrrishit909/cascadia`.
3. `.github/workflows/deploy.yml` (GitHub Actions, `actions/deploy-pages`) builds and deploys on every
   push to `main`.
4. Live site verified with real Playwright sessions against the public URL (not just curl), plus a
   second, fully independent reviewer with public-URL-only access. No publication-blocking findings.
5. `specifications/REQUIREMENTS.yaml`'s `CAS-RELEASE-001` row and `execution/PROGRESS.md` updated.

## Optional follow-ups (not blocking)

- Build the portfolio motion tile (`loop.mp4`/`loop.webm`) once `ffmpeg`/global `playwright` are
  available locally; the card works fine with just `cover.jpg` in the meantime (two other current
  portfolio projects are in the same state).
- Decide whether to gitignore this repo's `.claude/`/`.codex/`/`AGENTS.md`/`CLAUDE.md` agent-tooling
  files for public presentation; the independent reviewer flagged this as a non-blocking disclosure
  note, not a defect.

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

## What remains out of scope (not forgotten)

- `CAS-DATA-001`'s one open TODO: the underlying UW/IEEE benchmark's own license text was not located
  (pandapower's own license IS confirmed, BSD-3), flagged honestly in `DATA_CONTRACT.yaml` rather than
  assumed.
- Mobile bottom-sheet control pattern (chapters 2/3/5/6) and portrait-specific layouts for chapters 2-5
  - both documented, deliberate scope decisions in `LIMITATIONS.md`, not defects.
