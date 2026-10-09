# CASCADIA Overnight Summary

## Execution

- **Start:** 2026-10-08 23:57 EDT (M0 project init) / **Runner active:** 2026-10-09 00:18 EDT onward.
- **End:** 2026-10-09 03:04 EDT, queue exhausted, runner self-stopped cleanly (`automation/STOP` present).
- **Mechanism:** macOS `launchd` (`com.cascadia.overnight-runner`), one bounded task per fire every 20 minutes, verified with a real supervised trial before activation (caught and fixed 2 real bugs: missing `claude` in non-interactive PATH, no `timeout`/`gtimeout` binary on this Mac) plus a commit-ordering bug caught by the trial's second fire. See `automation/README.md`.
- **Tasks attempted:** 10 fires total. 9 succeeded on the task level; 1 (`e2e_keyboard_test`) failed its test command on the first attempt, was correctly caught by the runner's own safety check (stopped itself, preserved the dirty tree as evidence rather than discarding it), diagnosed by the orchestrating session (a stale Vite-template leftover test, not a bug in the new work), fixed, and resumed.
- **Tasks completed: 9/9** in `execution/TASK_QUEUE.json`.
- **Current milestone:** M1 complete; a scoped CASCADIA prototype (2 of 7 interactions) built, tested, and adversarially reviewed. **Not** a complete CASCADIA implementation.

## Engineering

- **Files:** ~25 commits across M0 (scaffold), M1 (data pipeline + creative direction), and the prototype build (frontend scenes, Worker LP, 2 controls, tests). Full history: `git log --oneline` in `~/cascadia`.
- **Algorithms implemented:**
  - Python oracle (`research/models/oracle.py`): island-aware DC-OPF linear program, `scipy.optimize.linprog` (HiGHS), piecewise-linearized generator costs, island detection via NetworkX, shed accounting split into removed-load / no-generation / economic.
  - TypeScript port (`src/engine/dcopf.ts`, run in `src/workers/lpWorker.ts` via the `highs` WASM package): the same formulation, hand-rolled connected-components (no graph library, per this repo's own dependency-lightness rule).
- **Datasets:** IEEE case30 via `pandapower.networks.case30()`, selected over case14 (rejected: a 27,479 kA line-rating sentinel value found by direct inspection during planning) and case9 (too small). Provenance chain: PYPOWER to University of Washington Power Systems Test Case Archive to pandapower (BSD-3-Clause).
- **Numerical validation (re-derived independently multiple times during the night, not trusted from any single report):**
  - Python oracle N-1 sweep: **195/195 cases** pass invariants, max per-island balance error **2.8e-14 MW** (tolerance 1e-6 MW).
  - Pandapower cross-check (feasible cases): flows agree to **9.6e-13 MW**.
  - TS Worker vs. Python oracle, same 195-case sweep: **195/195 pass**, max objective/shed relative delta **~8e-15** (tolerance 1e-3), re-confirmed by the final adversarial review with an independent per-bus balance check (**198/198**, worst **7.53e-13 MW**).

## Creative work

- **Design system:** `specifications/DESIGN_SYSTEM.json` -- real WCAG contrast ratios computed for every color pairing, elevation system, component states, 6-chapter composition-archetype table (no two adjacent chapters share a layout).
- **Typeface resolved:** Archivo Variable (SIL OFL 1.1), chosen over 3 reasoned-through alternatives.
- **Art direction:** `docs/ART_DIRECTION.md` -- 5 attributed references (link-only), full originality ledger, veto-list self-check (0 hits), and a falsifiable 2D-vs-WebGL judgment (agrees with the plan, adds a measured Canvas-2D-before-WebGL escalation ladder with explicit frame-time kill criteria for M4/M5).
- **Not yet built:** none of the 6 chapters' motion choreography, the opening storyboard, or any styled visual treatment. The current prototype is **functionally real but visually unstyled** -- correct for this stage, since motion/styling is M4 scope.
- **Screenshot evidence:** `verification/SCREENSHOTS/cas-int-001-keyboard-remove.png` (functional, confirmed by direct visual inspection, not just test-green) plus 2 more from the final adversarial review (infeasible state, the race-condition defect below).
- **Outstanding visual review:** everything -- no chapter has been styled or screenshotted yet.

## Quality

- **Tests passed (as of the final commit):** 10/10 Vitest, 1/1 Playwright e2e, 15/15 pytest, all re-run independently by the orchestrating session at multiple checkpoints throughout the night, not trusted from subagent self-reports.
- **Accessibility:** keyboard-only operability confirmed for both built controls (e2e + unit tests). No axe-core audit, no Lighthouse run, no frame-pacing measurement -- out of scope for a prototype slice.
- **Browser test results:** 1 Playwright e2e passing against the production build (`vite preview`), confirming the real browser Worker + WASM path, not a mock.

### THE HONEST VERDICT (from `verification/PROTOTYPE_REPORT.md`, written by an independent adversarial-reviewer pass that re-derived every claim itself)

**Prototype acceptance criteria: NOT MET.** 5 of 6 checklist items pass. One does not:

- **D1 (P1, the blocking finding):** a confirmed bus removal can be silently undone by a cross-control race. If a user confirms a substation removal and then touches the line-capacity slider before the removal's Worker solve resolves, the capacity request is built without the pending removal (state only records a removal after its solve completes), and it silently overwrites/loses the confirmed action. Reproduced in the real production build with an injected WASM load delay. The existing reset/interruption tests (built in an earlier task) did not catch this because they used a hand-mocked Worker, not the real timing-sensitive browser path -- the adversarial review specifically built a new reproduction script (`verification/review_scripts/race_reverse.mjs`) against the real app to find it.
- **D2 (P1):** the infeasible-state display fix (`f1142bb`, committed mid-run after the earlier `no_fake_numbers_audit` finding) covered the two text panels but not the SVG network view -- line labels and colors still imply a served network when the solve is infeasible.
- **D3-D6 (P2):** inconsistent bus numbering (0-based vs. 1-based) across two display surfaces, a stale SVG `aria-label`, a duplicated screen-reader alert, and a debounce-window input-drop edge case.

**This is not a failure of the night's work -- it is the QA pipeline working as designed.** A build agent cannot be trusted to grade its own homework; an independent adversarial pass that goes looking for exactly this kind of race condition, rather than re-running the existing test suite, is what caught a real defect before anyone called the prototype done.

## Repository status

- **Path:** `~/cascadia`, `main` branch, working tree clean.
- **Latest commit:** `153d2fe` (final summary).
- **Local build/preview:** `npm run build && npx vite preview --port 4173`.
- **Not deployed.** No remote configured, nothing pushed anywhere (per the explicit "no external publication" boundary).

## Blockers

- **D1 (P1), D2 (P1):** see above. Fix direction for both is specified in `verification/PROTOTYPE_REPORT.md`'s "Exact next steps".
- **No decisions require your authorization right now** -- D1/D2 are implementation bugs with a known fix direction, not scope or architecture questions.
- One pre-existing low-priority item: `CAS-DATA-001`'s underlying IEEE/UW benchmark license text still isn't located (pandapower's own BSD-3 license is confirmed; the original academic benchmark's exact terms are not).

## Next actions, in priority order

1. **Fix D1** (the race condition): make the `solving` action record the requested scenario so a later request is built from pending intent, not from stale `null` state; or simplest, disable the capacity slider while any solve is in flight (matching how the Remove controls already behave). Add a unit test that fires removal-then-capacity before the first reply resolves and asserts the final scenario keeps the removed bus. Re-run `PROTOTYPE_ACCEPTANCE_CRITERIA.md` item 5 after.
2. **Fix D2:** extend the infeasible-state treatment to `src/visualization/NetworkView.tsx` (explicit infeasible line/bus styling, dynamic `aria-label`).
3. Fix D3-D6 (all small, independently listed in `PROTOTYPE_REPORT.md`).
4. Re-run the full `PROTOTYPE_ACCEPTANCE_CRITERIA.md` checklist. Only once it's genuinely MET, proceed to M4 (the remaining 5 interactions -- CAS-INT-002/003/004/006/007 -- plus motion choreography for all 6 chapters), M5 (full QA: the evidence harness at 1440/768/390, axe, Lighthouse, frame pacing), and M6 (deployment + smoke test), per `IMPLEMENTATION_PLAN.md`'s task graph.
5. **To resume:** `cd ~/cascadia`, read this file and `verification/PROTOTYPE_REPORT.md`, add D1/D2 as new bounded tasks to `execution/TASK_QUEUE.json` (following the existing task-prompt pattern in `automation/tasks/`) before re-arming the runner (`rm automation/STOP && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.cascadia.overnight-runner.plist`), or continue interactively.

**Do not represent CASCADIA, or even this prototype, as complete.** 2 of 7 interactions are wired, 0 of 6 chapters have motion, nothing is deployed, and the prototype's own acceptance criteria are not yet met.
