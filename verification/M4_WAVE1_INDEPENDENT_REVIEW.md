# M4 wave 1 independent review (CAS-INT-002/003/007 + shared state machinery)

- Reviewer: an adversarial reviewer session, separate from the implementer. Date: 2026-10-09.
  HEAD at review start and end: `4d4e9b1`, clean tree (verified `git status --porcelain` before and
  after every mutation check below).
- Nothing in commit messages, REQUIREMENTS.yaml notes, code comments claiming something was
  "verified"/"confirmed", or `e2e/newControls.spec.ts`'s own test comments was taken as evidence.
  Every claim below was re-derived independently: real `npm run build && npx vite preview`, real
  Playwright against the real Worker/WASM HiGHS solver, real `uv run python` calls into
  `research/models/oracle.py`, and (for mutation checks) a real revert-build-test-restore cycle
  against actual git history, never a hypothetical.
- Scripts are in `verification/m4wave1_independent_scripts/` (reviewer-authored, separate from any
  implementer review_scripts). They need `npm run build && npx vite preview --port 4173` running.
- Environment: macOS, Node v24.21.0, Playwright (bundled Chromium, both headless and headed tested).
- Scope: `IncreaseLoad.tsx` (CAS-INT-002), `ReduceGenerator.tsx` (CAS-INT-003), `LineOutage.tsx`
  (CAS-INT-007), shared `state.tsx`/`ScenarioReadout.tsx`, `e2e/newControls.spec.ts`, the
  load_gen_sweep/add_line_restoration oracle work, and `AlterCapacity.tsx`/`RemoveNode.tsx` only as
  referenced by the prior D1/D2 review and by this wave's own claims about them.

## Verdict

**No P0 or P1 defects found in the three new controls or in the shared state machinery.** Every
fix this wave claims to have made, the N1 (allowShed threading), N2 (draft-resync), and N3
(pendingRef) bug classes carried into `IncreaseLoad`/`ReduceGenerator`/`LineOutage` via
`runScen`/`base()`/`pendingRef`, plus the two LineOutage focus-management fixes, held up under
probing that was deliberately more aggressive than what's documented as already done: same-tick
synthetic event races (not just sequential Playwright actions), a from-scratch mechanism
investigation of the select-then-slider race rather than trusting the existing explanation, real
keyboard-driven focus probes beyond the existing suite, three mutation checks on tests not already
documented as mutation-checked, headed-Chromium testing, and three brand-new infeasible scenarios
cross-checked against the Python oracle independently.

What I *did* find:
- **One empirically wrong causal claim** (M1) in both the test file's own comment and
  REQUIREMENTS.yaml about *why* the select-slider race needed a concurrent perturbation to
  reproduce. The fix is still correct; the explanation of the bug's trigger condition is not.
- **One REQUIREMENTS.yaml documentation defect** (M2): two requirement notes cite a superseded,
  weaker mutation-check number (3/10) while explicitly attributing it to the *current, strengthened*
  test, when that test's own comment and the commit that wrote the note both say the strengthened
  version actually gets 20/20. This *understates* the real evidence, so it is not a safety issue,
  but it is exactly the kind of overclaim/mismatch this review exists to catch, and it survived the
  one commit (`4d4e9b1`) explicitly dedicated to correcting "3 false ledger claims."
- **One confirmed-still-open pre-existing issue** (M3), already known from the D1/D2 review (N4/D6),
  not introduced or claimed-fixed by this wave.
- **One imprecise framing** (M10) of the native-`<select>` keyboard limitation as "headless-only,"
  which I found also reproduces in headed Chromium (via Playwright/CDP), though I could not test
  genuine OS-level hardware key injection either way.

Full breakdown below. All mutations were applied directly to the working tree with
`git show <rev>:<path> > <path>`, built, tested, then restored with
`git checkout HEAD -- <path>` and rebuilt; `git status --porcelain` was empty before I started and
is empty now except for this review's own new files under `verification/`.

## Real test-suite numbers (run in this review, from a clean `4d4e9b1` tree)

| Command | Result |
|---|---|
| `uv run pytest -q` | **26 passed** |
| `npx vitest run` | **7 files / 18 tests passed** |
| `npx vitest run tests/unit/addLineRestorationParity.test.ts tests/unit/loadGenParity.test.ts` | **2/2 passed** |
| `npm run build` | clean (`tsc -b && vite build`) |
| `npx playwright test` (production preview, port 4173) | **25 passed**, 0 failed |
| `npx playwright test e2e/newControls.spec.ts --repeat-each=4 --workers=3` | **60/60 passed**, no flakes |
| `uv run python -m research.evaluate.add_line_restoration` | 24 add-line cases, **0 invariant failures**, 4 restoration-ranking cases produced |

The `verification/D1_D2_INDEPENDENT_REVIEW.md` baseline of 8 e2e tests (concurrency.spec.ts +
keyboard spec) is unchanged; `newControls.spec.ts` adds the other 17, for 25 total, matches
the repo's actual state, not any count asserted in a commit message.

## Findings

### M1 (informational / narrative correction, no severity, the fix is correct, the stated mechanism is not)

**The claim** (test comment, `e2e/newControls.spec.ts:52-54`, and mirrored in REQUIREMENTS.yaml's
CAS-INT-002/003 notes): "The checkbox's own debounced solve (AlterCapacity) running concurrently
during the loop is what perturbs the timing enough to hit the window at all; the single-generator
case (no checkbox) didn't reproduce it."

**What I found**, reverting `ReduceGenerator.tsx` to `0483f97^` (pre-fix) and running real-keyboard
`.focus()` + `.press('Home')` probes (`verification/m4wave1_independent_scripts/mechanism_probe.mjs`,
`mechanism_probe2.mjs`), 15 reps each condition:

| Condition | Lost |
|---|---|
| A) 4-generator back-to-back loop, **no checkbox**, no settle wait between iterations | **15/15** |
| B) Same loop **with** the AlterCapacity checkbox perturbation (the documented repro shape) | **15/15** |
| C) Same loop with an inert "perturbation" (focusing unrelated bus buttons, no dispatch, no state change, no solve at all) | **15/15** |
| D) TRUE single-shot: one generator, select + Home + Apply, no loop | **0/15** |
| E) 4-generator loop, but each iteration's solve is **allowed to fully settle** before the next starts | **0/15** |

The checkbox is not necessary (A and C reproduce without it, including a "perturbation" that does
nothing at all). What's necessary and sufficient is firing the **next** generator's select+slider
back-to-back, **before the previous iteration's own async solve/dispatch has settled**, the
control is self-perturbing. Each iteration's `setGenPmax` call is an async Promise around a Worker
round trip; its own `solving`→`solved` dispatches are not discrete-event-triggered, so they don't
get React's "flush passive effects before the next discrete event" guarantee the same way a plain
click does. A rapid loop keeps that non-discrete activity live, which is enough to let the next
iteration's `[gen]`-keyed resync effect lag behind the immediately-following slider keypress, no
external control needed. The checkbox in the actual test is incidental, not causal.

This doesn't weaken the real regression test (it IS genuinely non-vacuous, confirmed by the
documented 20/20 mutation check and independently by my own mutation checks elsewhere in this
review) and doesn't change the verdict that the fix is correct. But if a future maintainer "simplifies"
the test by assuming the checkbox step is load-bearing when it isn't (or, worse, assumes the loop
structure is incidental when IT is what's load-bearing), the test's protective value could be lost
without anyone noticing, because the comment points at the wrong mechanism.

### M2 (P2, documentation/traceability defect in REQUIREMENTS.yaml, not a functional bug)

CAS-INT-002's note: *"...reproduced directly in ReduceGenerator.tsx (3/10 with real keyboard input,
higher with scripted .fill())..."* CAS-INT-003's note: *"Mutation-checked against the regression
test's actual (not vacuous) shape: reverting the fix reproduced the race in 3/10 real-keyboard
runs."*

Per `e2e/newControls.spec.ts`'s own comment (lines 43-54) and the commit that wrote both of these
exact note strings (`4d4e9b1`): the **3/10** figure is explicitly from an *earlier, weaker* probe
("An earlier looser probe using just the final 'n/a (infeasible)' check (no .provenance watch) only
failed 3/10 times") that was superseded; the **current, strengthened test** (with the `.provenance`
MutationObserver watch, which is precisely what makes it "not vacuous") gets **20/20** fails on
pre-fix code, per both the test comment and the commit message: *"Re-ran the mutation check against
this strengthened version: 20/20 repeat-each runs FAILED against the pre-fix component... the
earlier '3/10' figure came from the final-assertion-only version and is now superseded."*

So both notes attribute the superseded 3/10 number to "the regression test's actual (not vacuous)
shape," when the commit's own message says that shape gets 20/20. This slipped through the one
commit (`4d4e9b1`, "Final advisor pass: correct 3 false ledger claims...") explicitly dedicated to
fixing exactly this class of error. Net effect: the evidence is actually *stronger* than claimed
(20/20, not 3/10), so this is not a safety-relevant overclaim, but it is a real, specific,
independently-verifiable mismatch between a REQUIREMENTS.yaml note and the artifact it cites.

### M3 (P2, confirmed-still-present pre-existing issue, not new, not claimed fixed by this wave)

`AlterCapacity.tsx`'s quick-line-switch bug, documented as N4/D6 in
`verification/D1_D2_INDEPENDENT_REVIEW.md` ("Dropped change on quick line switch... silently drops
the line-9 change: zero Worker requests are posted... still open"), reproduces identically on
current HEAD (`verification/m4wave1_independent_scripts/altercapacity_quickswitch.mjs`, 5/5 runs):
select line 9, nudge its slider (0.95x, debounce timer armed but not yet fired), then select line 10
within the 250ms window, **zero** Worker requests are ever posted for line 9's change (`resync()`'s
unconditional `clearTimeout(timer.current)` on every `[selectedLine]` effect kills the still-pending
timer). This is outside this wave's scope (AlterCapacity/CAS-INT-005 is not one of the three new
controls) and was already known and accepted as P2; I confirm it is unaffected by M4 wave 1, for
the record.

### M4 (confirms + strengthens a prior claim): AlterCapacity resists the select-slider race even under a stricter test than its own "15/15"

`0483f97`'s commit message says AlterCapacity was "separately confirmed... NOT vulnerable to the
same interleaving (15/15 clean)," using a real round-trip slider move from 1.0→0.5. The task brief
asked whether a less obviously-changing move, or a maximally adversarial ordering, would still hold.
I forced the worst case directly: a single `page.evaluate` call that dispatches the `<select>`'s
native `change` event and the slider's native `input` event **in the same synchronous JS tick** (no
round trip at all, strictly tighter than any sequence of separate Playwright actions), selecting a
fresh line and setting its capacity to 0.5 while a different line already has a confirmed 0.95x
(`altercapacity_resync_race.mjs`, 10 reps). **0/10** showed any mismatch: the displayed slider
always read 0.50x and the Worker request always carried the correct `{"4":0.95,"9":0.5}`. This is
stronger evidence than the original 15/15 and closes the task's specific concern about
AlterCapacity's effect-based resync pattern (as opposed to the synchronous-handler pattern the two
new controls use), the effect genuinely cannot be beaten by even a same-tick synthetic event
sequence, consistent with React 18 flushing pending passive effects before a new discrete DOM event
is handled.

### M5 (confirms, closes an honestly-flagged gap): IncreaseLoad's "fixed by analogy" claim holds

REQUIREMENTS.yaml's CAS-INT-002 note honestly states the select-slider race fix in `IncreaseLoad.tsx`
"was applied by analogy... and was not independently reproduced there." I ran the identical
real-keyboard select-then-immediate-ArrowRight interleaving used for ReduceGenerator's own
regression test against `IncreaseLoad.tsx`, both with and without the AlterCapacity checkbox
perturbation, 20 reps each (`increaseload_race_probe.mjs`), watching `.provenance` for the
smoking-gun "load x1" (the value Apply would submit if the slider were silently reverted to the
no-op default). **0/20 in both conditions.** The fix genuinely holds for IncreaseLoad too, the gap
REQUIREMENTS.yaml honestly flagged as unverified is now closed.

### M6 (confirms): LineOutage focus management holds under probes beyond the existing suite

Four real-keyboard (`.focus()` + `.press()`, never `.click()`) probes not covered by the existing
e2e tests (`lineoutage_focus_probe.mjs`):
1. Pressing the **Cancel button itself** via real keyboard (not Escape) correctly returns focus to
   "Disable line," not `<body>`.
2. Dispatching Escape from a non-button descendant (`<p>` inside the confirm group, bubbling) still
   reaches the section's `onKeyDown` handler and closes the confirm group correctly.
3. Confirm→solve→settle with **no** WASM delay (the fast path, not just the already-tested 1500ms
   deferred path) correctly lands focus on "Restore line," not dropped.
4. Pressing Escape when no confirm group is open is a harmless no-op; trigger and focus are
   unaffected.

All four passed. Combined with the existing suite's two focus tests, this is now a reasonably
thorough independent confirmation of both documented focus-drop fixes (entering confirm, and both
ways of leaving it, the naive and the deferred-disabled-button cases).

### M7, mutation checks on three e2e tests NOT already documented as mutation-checked

Per `git show <rev>^:<path> > <path>` → rebuild → run → `git checkout HEAD -- <path>` → rebuild
(verified clean before/after each):

1. **"a disabled line can be restored via keyboard directly on the SVG..."**, reverted
   `NetworkView.tsx`+`App.tsx` to `db1aadb^`. Test fails exactly as expected: `toBeVisible()` on the
   outaged SVG line times out (`element(s) not found`) because the pre-fix code renders disabled
   lines as an inert `<line>` with no `data-outaged`/role/handlers. Genuine, not vacuous.
2. **"N1: increasing load respects 'Allow load shedding' off..."**, mutated `state.tsx`'s `params()`
   to hardcode `allow_shed: true` (reverting the N1 threading fix). Test fails exactly as expected:
   `load-unserved` reads "54.00 MW" instead of "n/a (infeasible)". Genuine, not vacuous.
3. **"regression: focus returns to 'Restore line' after Confirm outage's solve settles..."**
   reverted `LineOutage.tsx` to `4d4e9b1^` (removing the deferred `awaitingTriggerFocus` mechanism,
   keeping only the naive immediate-focus version). Test fails exactly as expected:
   `toBeFocused()` times out with the button still `disabled`. Genuine, not vacuous.

### M8, independent oracle cross-checks (Python `solve()` called directly, never through the TS engine or UI first)

Reproduced from scratch via `PYTHONPATH=. uv run python -c "..."` calling
`research/models/oracle.py`'s `solve()` directly, then separately confirmed each result against the
live UI (production build, real Worker):

| Scenario | Oracle result | UI result |
|---|---|---|
| `load_scale={7:4}, line_capacity_factor={9:0.95}` (the e2e D1 combo case) | optimal, 78.6289 MW unserved | `load-unserved` = "78.63 MW" ✓ |
| `gen_pmax_mw={0:0,1:0,2:0,3:0}, allow_shed=False` | infeasible | "n/a (infeasible)" ✓ |
| `disabled_lines=[33], allow_shed=False` | infeasible | "n/a (infeasible)" ✓ |
| `disabled_lines=[33], allow_shed=True` | optimal, 3.5 MW shed | (not UI-checked, oracle-only sanity check) |
| `load_scale={1:10}, allow_shed=False` | infeasible | "n/a (infeasible)" ✓ |

Plus **three novel scenarios not present anywhere in the existing test suite**, independently
computed via the oracle first, then verified against the live UI
(`novel_infeasible_probe.mjs`), all correct and never showing a fake "0.00 MW":
- Bus 6 (22.8 MW load) at 10x, shedding off → oracle: infeasible; UI: `load-unserved` = "n/a (infeasible)", and a full-page text scan for the literal string "0.00 MW" found none.
- Generators 0+1+3 zeroed (**skipping gen 2**, a combination not in the suite's 0-1-2-3 sweep), shedding off → oracle: infeasible; UI: `gen-unserved` = "n/a (infeasible)".
- Lines 36+37 both outaged (an island-pocket pair from `add_line_restoration.py`'s own `RESTORE` fixtures, not line 33), shedding off → oracle: infeasible; UI: `outage-unserved` = "n/a (infeasible)", `outage-list` = "36, 37".

The 40-case `load_gen_sweep.json` was independently recomputed/inspected directly (not just via the
vitest parity test): 40 cases total, exactly 8 with partial shed (`0 < shed < 189.2`), including
`combo_line9_cap_x0.95_load_bus7_x4`, matching REQUIREMENTS.yaml's CAS-INT-002 note exactly.

CAS-INT-004/006 engine-only work (`add_line_restoration.py`, `dcopf.ts`'s `added_lines` support,
`candidate_lines.json`) is real and tested, not scaffolding: ran the script directly (24 add-line
cases, 0 invariant failures, 4 restoration-ranking cases with sane results), and
`addLineRestorationParity.test.ts` passes 2/2. REQUIREMENTS.yaml correctly leaves CAS-INT-004/006 as
`unstarted`/`evidence_paths: []` at the requirement level, since there is genuinely no UI control
this is accurate, not an omission.

No `Date.now()`, `Math.random()`, or similar in any of the 5 in-scope files
(`IncreaseLoad.tsx`, `ReduceGenerator.tsx`, `LineOutage.tsx`, `state.tsx`, `ScenarioReadout.tsx`)
confirmed by grep, zero matches.

### M9 (P2, cosmetic doc nit)

`tests/unit/loadGenParity.test.ts`'s own header comment says the sweep has "39 cases (7 of which
force partial shed," but the actual `load_gen_sweep.json` has 40 cases / 8 partial-shed (confirmed
above), and the test's own code three lines later asserts `expect(rows.length).toBe(40)`. The
comment contradicts the file's own executable assertion. No functional impact, purely a stale
comment.

### M10 (precision nuance, not a contradiction)

REQUIREMENTS.yaml's CAS-UX-001 note frames the native-`<select>` keyboard limitation as specific to
"headless Chromium." I ran the identical `ArrowDown` and `Alt+ArrowDown`→`ArrowDown`→`Enter`
sequences in **headed** Chromium (`headless: false`) via Playwright
(`headed_select_test.mjs`) and got the identical result as headless: the select's value never
changed. So the limitation is not specific to headless mode, it is a limitation of
Playwright/CDP's synthetic keyboard dispatch against a native OS-rendered `<select>` popup, in both
modes. This does not contradict the note's actual conclusion (a native select is keyboard-operable
for a **real user** via the OS's own dropdown, and this is a test-tool constraint, not an app
accessibility gap), I could not go further and test genuine OS-level hardware key injection in
either mode, so I cannot confirm or deny real-user operability myself; I can only say the narrower
"headless-only" framing is imprecise, and flag explicitly that true-hardware-input testing was
outside what I could verify in this sandbox.

## What I did not find (explicitly, so this isn't mistaken for an incomplete pass)

- No case where a confirmed/in-flight intent from any of the 3 new controls was silently lost to a
  cross-control race (D1-class), tried checkbox-concurrent, bus-focus-concurrent, same-tick
  synthetic races, and the existing suite's own D1/N2 tests, repeated 4x with 3 workers with no
  flakes.
- No infeasible scenario, including 3 I constructed myself outside the existing suite, that rendered
  as a fake finite number instead of "n/a (infeasible)."
- No fake/cosmetic numeric source (`Date.now`/`Math.random`/animation-derived) in any of the 5
  in-scope files.
- No regression in `AlterCapacity.tsx`/`RemoveNode.tsx` from this wave's changes (both still pass
  their own existing suites at 25/25, and AlterCapacity's resync held even under a stricter probe
  than previously documented).

## Next steps (for the orchestrator, not actioned by me, this is a review, not a fix pass)

1. Correct REQUIREMENTS.yaml's CAS-INT-002/003 notes: replace "3/10" with "20/20" (or cite both
   numbers with which probe each belongs to), matching the test's own comment and the commit that
   wrote the note (M2).
2. Rewrite the test comment at `e2e/newControls.spec.ts:52-54` and the matching REQUIREMENTS.yaml
   language: the checkbox is not what makes the race reproducible; the back-to-back loop (any
   source of concurrent non-discrete React activity, including the control's own async solve) is
   (M1). Low risk either way, since the test itself is not vacuous regardless of the explanation.
3. M3 (AlterCapacity quick-line-switch drop) remains open from the prior review; still P2, still not
   addressed, not blocking.
4. Fix the stale "39 cases (7...)" comment in `tests/unit/loadGenParity.test.ts` to say 40/8 (M9).
5. Consider rewording CAS-UX-001's note from "headless Chromium does not..." to "Playwright's
   synthetic keyboard dispatch does not..., confirmed in both headless and headed Chromium" (M10)
   optional precision improvement, not required for correctness.
