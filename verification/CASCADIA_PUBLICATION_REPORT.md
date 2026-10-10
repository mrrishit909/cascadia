# CASCADIA Publication Report

Phase 6 of the "CASCADIA -- FINAL DEPLOYMENT, LIVE VERIFICATION & PORTFOLIO INTEGRATION" directive.
Companion to `verification/CASCADIA_FINAL_ACCEPTANCE_REPORT.md` (release-candidate evaluation) and
`verification/CASCADIA_FINAL_HANDOFF.md` (practical resume reference). This is the single consolidated
record of publication: where everything lives, what was checked, and by whom.

## Public URLs

| | URL |
|---|---|
| Live website | https://mrrishit909.github.io/cascadia/ |
| GitHub repository | https://github.com/mrrishit909/cascadia |
| Portfolio home | https://mrrishit909.github.io/projects/ |
| Case study | https://mrrishit909.github.io/projects/cascadia/ |

## Deployment commit and workflow

- **Release-candidate commit (evaluated/accepted):** `594d63c`, tagged `release-candidate-594d63c`.
- **Deployed commit (current live build):** `47c5c46` on `main`.
- **Deployment workflow:** `.github/workflows/deploy.yml`, GitHub Actions
  (`actions/checkout`, `actions/setup-node@v4` node 24, `npm ci`, `tsc --noEmit`, `npm run test -- --run`,
  `npm run build`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`), triggered on every
  push to `main`.
- **Base path:** `vite.config.ts`'s `base: '/cascadia/'`, matching the GitHub Pages project-page URL.

## Live smoke-test results

First-party verification, real Playwright sessions against the actual public URL (not just curl, not
assumed from a green Actions run): 15/15 checklist items PASS, zero console/page errors, zero 404s,
across desktop/tablet/mobile, under both default and reduced-motion. Full detail:
`verification/LIVE_VERIFICATION/LIVE_VERIFICATION_REPORT.md`.

## Lighthouse results (live public URL)

| | Desktop | Mobile |
|---|---|---|
| Performance | 100 | 100 |
| Accessibility | 100 | 100 |
| LCP | 0.4s | 1.5s |
| CLS | 0 | 0 |

Both exceed the release gate (Performance >=90, Accessibility >=95, LCP <=2.5s, CLS <=0.1) with wide
margin. Independently reproduced by the Phase 5 reviewer below.

## Independent verification findings (Phase 5, public-URL-only)

A separate reviewer with no local repo access confirmed, against the live public URLs only: the app's
real solver (different bus removals produce independently different LP outputs), FIG. 05's restoration
comparison firing real Worker/WASM requests, the portfolio home page and search, the case-study page's
accuracy and working demo/repo links, the GitHub repo's content and that the live Pages build matches
current `main` HEAD (via the GitHub API), and basic accessibility/functional sanity. **Verdict:
CONFIRMED WORKING on all six checks, no publication-blocking issues.** Full report:
`verification/LIVE_VERIFICATION/INDEPENDENT_PUBLICATION_REVIEW.md`.

## Remaining limitations

- This repo's `.claude/`, `.codex/agents/`, `.agents/skills/`, `AGENTS.md`, `CLAUDE.md` scaffolding is
  publicly visible in the GitHub tree, and GitHub lists the sole contributor as "Claude." Flagged by
  the independent reviewer as a presentation choice for the project owner, not a functional or
  security defect; not acted on without the owner's direction, since it would mean rewriting public
  history or restructuring the repo.
- The portfolio card has no motion tile (`loop.mp4`/`loop.webm`); `ffmpeg` and a global `playwright`
  install are unavailable in this environment to render one. The card displays its static cover image
  instead, a non-fatal, disclosed state matching two other current portfolio projects.
- Everything already on record in `LIMITATIONS.md` (chapter 6 rail's zero page-scroll sticky range at
  desktop, chapters 2-5 reusing the landscape network projection at narrow widths, one open concurrency
  edge case in AlterCapacity's debounce window, one inconclusive desktop frame-pacing measurement)
  stands unchanged; deployment did not touch any of it.

## Conclusion

CASCADIA is published and independently verified end to end: live application, GitHub repository, and
portfolio integration all resolve, function correctly, and were checked by a reviewer with no access
to this session's own work. `CAS-RELEASE-001` is updated to `independently verified` in
`specifications/REQUIREMENTS.yaml`. No further action is required to consider this project shipped.
