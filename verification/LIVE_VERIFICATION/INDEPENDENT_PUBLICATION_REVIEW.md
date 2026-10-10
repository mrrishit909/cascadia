# Independent Publication Review (Phase 5)

Reviewer had **public-URL-only access**: no local repo, no prior session notes. Verified the live
CASCADIA app, the GitHub repo, the portfolio home page, and the case-study page purely as an outside
visitor would experience them, using real Playwright/Chromium sessions, the GitHub API, and an
independent Lighthouse run.

**Verdict: CONFIRMED WORKING on all six checks. No publication-blocking issues found.**

## 1. CASCADIA app works publicly, CONFIRMED

`https://mrrishit909.github.io/cascadia/`: 0 console errors, 0 page errors, 0 failed/4xx/5xx requests.
Correct title. SVG network present (90 circles, 295 lines). All six chapter nav links clickable.

Interactive solver proof: removed Bus 0, confirmed `data-state` flipped `served` to `removed` and the
`aria-label` updated accordingly. Removing different buses (Bus 1 vs Bus 27) produced genuinely
different solver outputs (Objective +48.33 vs +12962.15; Islands 1 vs 2; Isolated MW 0.00 vs 13.00),
proving a real live LP solve, not a canned animation. FIG. 05's "Compare restoration" control fired
real `lpWorker-*.js` / `highs-*.wasm` network requests and rendered three correctly labeled restoration
networks with a matching step chart.

## 2. Portfolio link works, CONFIRMED

`https://mrrishit909.github.io/projects/` loads correctly; searching "CASCADIA" returns exactly 1
record; opening it shows correct metadata and a working "Open project directly" link to the case study.
0 console errors.

## 3. Case study is accurate, CONFIRMED

`https://mrrishit909.github.io/projects/cascadia/` loads cleanly, content is specific and
self-critical (cites real test counts, two real bugs with root causes, disclosed open limitations).
"Launch Live Website" and "Code on GitHub" links both resolve (200). The reviewer independently ran
Lighthouse against the live app and reproduced the case study's claimed numbers exactly (desktop
Performance 100 / Accessibility 100 / LCP 0.4s / CLS 0).

## 4. GitHub repo resolves, CONFIRMED

`https://github.com/mrrishit909/cascadia`: 102 commits, real directory structure, README +
ARCHITECTURE.md present. Via the GitHub API, the latest commit on `main` (`47c5c46`) has a successful
"Deploy to GitHub Pages" Actions run at the same timestamp, i.e. the live site is verifiably built from
current HEAD.

**Non-blocking disclosure note:** the repo's `.claude/`, `.codex/agents/`, `.agents/skills/`,
`AGENTS.md`, and `CLAUDE.md` files are publicly visible in the tree, and GitHub lists the sole
contributor as "Claude." Not a functional or security defect, a presentation choice for the project
owner to decide on.

## 5. Deployed version matches source, CONFIRMED

Live app is the fully styled, animated production build, not a placeholder. Corroborated by the
GitHub Actions evidence above and by the independent Lighthouse run matching the case study's claimed
numbers exactly.

## 6. No critical accessibility/functional regression, CONFIRMED

Proper heading structure, landmark elements, `role="button"`/`aria-pressed`/`aria-label` on interactive
nodes updating correctly on state change, visible focus ring on Tab navigation, no broken/empty page
state observed at any point.

## Evidence

Screenshots and Playwright scripts: `/tmp/cascadia-qa/` on the reviewer's own session (01-intro.png,
03-fig04.png, 11-tracked-after.png, 21-portfolio-search-cascadia.png, 22/23 portfolio-to-case-study
navigation, 24-case-study-full.png, 30-github-repo.png, 40-43 FIG.05 compare evidence, lh.json
Lighthouse report).
