# M4 INT-004/006 independent review (add line + compare restoration)

- Reviewer: an adversarial reviewer session, separate from the implementer. Date: 2026-10-09.
  HEAD at review start and end: `a0e9d23`, clean tree (`git status --porcelain` empty before I
  started and empty now except this review's own new files under `verification/`).
- Nothing in commit messages, REQUIREMENTS.yaml notes, code comments claiming "verified"/
  "confirmed", or any existing test's own comments was taken as evidence. Every claim below was
  re-derived independently: real `npm run build && npx vite preview`, real Playwright against the
  real Worker/WASM HiGHS solver, real `uv run python` calls into `research/models/oracle.py`, and
  (for mutation checks) a real revert-build-test-restore cycle against actual git history.
- Scripts are in `verification/m4_int004_006_independent_scripts/` (reviewer-authored). Several are
  scratch `.test.ts`/`.test.tsx` files that vitest's config only discovers under `src/**` or
  `tests/unit/**/*.test.ts`; those were copied there, run, and deleted immediately after (confirmed
  by `git status --porcelain` on `src/`/`tests/` showing no residual files) -- the permanent copies
  live only under `verification/`.
- Environment: macOS, Node v24.21.0, Playwright (bundled Chromium, headless).
- Scope: `src/interactions/AddLine.tsx` (CAS-INT-004), `src/interactions/CompareRestoration.tsx`
  (CAS-INT-006), `src/workers/lpWorker.ts`, `src/workers/lpClient.ts`, the `addedLines`/`candidates`
  additions to `src/app/state.tsx`, `src/app/App.tsx`'s SVG toggle handler, `e2e/addLine.spec.ts`,
  `e2e/compareRestoration.spec.ts`, `research/evaluate/add_line_restoration.py`,
  `verification/REFERENCE_RESULTS/add_line_restoration.json`.

## Verdict

**No P0 or P1 defects found.** The AddLine SVG-toggle fix holds under adversarial timing variation
well beyond the existing test's exact repro. CompareRestoration's private-Worker isolation is real
(genuinely separate `createLpClient` instance and `Worker`, not a shared singleton reached through
a different door), and it demonstrably does prevent the shared-queue hang this review reproduced
independently. The 4 hardcoded presets match `research/evaluate/add_line_restoration.py`'s `RESTORE`
dict character-for-character, and the reference JSON is reproducible byte-for-byte from the current
Python source. Two novel add-line scenarios and one novel restoration scenario (none in the existing
suite) were independently computed from the oracle/TS engine and matched the live UI/engine exactly.
No fake numeric source in either file. CompareRestoration is genuinely keyboard-operable end to end.

What I found, below: one P2 documentation/precision mismatch (F1, same class as the prior review's
M1) about what actually triggers the `SupersededError` branch in `CompareRestoration.tsx`, and one
P2 observation (F2) that the Worker-termination-on-unmount cleanup, while mechanically correct, has
no reachable trigger in the current single-page app.

## Real test-suite numbers (run in this review, current HEAD)

| Command | Result |
|---|---|
| `uv run pytest -q` | **26 passed** |
| `npx vitest run` | **7 files / 18 tests passed** |
| `npm run build` | clean (`tsc -b && vite build`) |
| `npx playwright test` (fresh build via `playwright.config.ts`'s own `npm run build && npm run preview`, confirmed by deleting `dist/` first) | **38 passed**, 0 failed |
| `uv run python -m research.evaluate.add_line_restoration` | 24 add cases, 0 invariant fails, 4 restoration cases; output **byte-identical** (`diff`) to the committed `verification/REFERENCE_RESULTS/add_line_restoration.json` |

`playwright.config.ts`'s fresh-build-before-serve fix (the documented past false-pass risk) was
exercised directly: `dist/` was deleted before the `npx playwright test` run above, and all 38 tests
still passed against a build the webServer command produced itself, not a stale one.

## Findings

### 1. AddLine's SVG-toggle fix: reproduced the original bug, confirmed the fix holds under broader adversarial timing

Reverted `src/app/App.tsx` to `a898a09^` (`git show a898a09^:src/app/App.tsx > src/app/App.tsx`),
rebuilt, and ran my own probe (`addline_toggle_probe.mjs`) that goes beyond the existing test's exact
shape (1500ms WASM delay, 300ms wait, exactly 2 clicks): 3 WASM delays (0/300/1500ms) x 6 inter-click
waits (0/50/100/300/700/1000ms) x 5 reps = 90 runs, clicking the candidate-0 SVG line twice (add,
then intended-remove).

**56/90 failed against the pre-fix code** (every combination where the WASM delay was non-zero, or
delay=0 with a 0-50ms wait -- i.e. whenever the second click genuinely landed before the first solve
settled): the second click re-submitted "add" instead of "remove," exactly the documented bug.

Restored `App.tsx` to HEAD (`git checkout HEAD -- src/app/App.tsx`, confirmed `git diff` empty),
rebuilt, reran the identical 90-run probe: **0/90 failed.** The fix genuinely holds across a much
wider timing envelope than the single documented combination, not just the exact repro already in
`e2e/addLine.spec.ts`.

### 2. CompareRestoration's Worker isolation: architecturally real, and the hang it prevents is real

**(a) Genuinely separate instance, not a shared singleton reached differently.** `state.tsx`'s shared
client is created once via `useMemo(() => solver ?? workerSolver(), [solver])`, where `workerSolver()`
closes over its own `client` variable, lazily constructed on first `solve()` call
(`src/app/state.tsx:109-115`). `CompareRestoration.tsx`'s `useRankClient()` independently calls
`new Worker(...)` and `createLpClient(...)` inside its own `useRef`-backed closure
(`CompareRestoration.tsx:24-35`). `createLpClient` (`src/workers/lpClient.ts:10`) is a plain factory
function with no module-level state -- each call produces its own `latest` counter and `pending` map.
There is no code path (grepped for any shared import, singleton, or module-level `let client` outside
`workerSolver`'s own closure) by which CompareRestoration could end up reusing the shared instance.

**(b) The hang is real, confirmed two ways.**
- Existing e2e (`compareRestoration.spec.ts:44`) already proves isolation holds in the real app
  (confirm a bus removal, let its solve go in-flight for 1.5s, click Compare, both land correctly).
- Independently, I wrote a vitest test (`verification/m4_int004_006_independent_scripts/shared_queue_hang.test.ts`, run from a temporary copy under `tests/unit/` and deleted after) that
  uses the REAL `createLpClient` from `src/workers/lpClient.ts` with a single shared instance (i.e.
  simulating what would happen if CompareRestoration reused the main client instead of its own): a
  `solve()` is fired and left in flight, then a `rank()` fires on the SAME client. The `solve()`
  promise rejects with `SupersededError`, and mirroring `state.tsx`'s actual catch-block logic
  (`if (!(e instanceof SupersededError)) dispatch(...)`, confirmed by reading `removeBus`/`setCapacity`/
  `runScen` in `src/app/state.tsx:159-215`) shows **no recovery dispatch ever fires** for the
  superseded request -- the exact hang (a control's `solve` state stuck at `'solving'`, Confirm/Apply
  disabled forever, no error shown) the isolation is meant to prevent. A second test in the same file
  confirms two genuinely separate `createLpClient` instances (the real architecture) never interfere.

**(c) `SupersededError` handling in `compare()` does not leak or get stuck, but the inline comment's
framing of when it triggers is imprecise (P2, same class as the prior review's M1).** The comment at
`CompareRestoration.tsx:64` says the branch is hit when "superseded by a later compare() call
(re-picking a preset mid-rank)." Both the `<select>` and the Compare button are `disabled={status ===
'loading'}`, so neither can be touched by a real user while a rank is in flight -- "re-picking a
preset mid-rank" is not literally reachable through the rendered UI. I probed this directly
(`compare_resubmit_probe.mjs`): dispatching two synchronous `click` events at the DOM level (bypassing
Playwright's own actionability checks) on the Compare button, with a `change` event on the `<select>`
spliced in between, still resulted in exactly **one** `Worker.postMessage` call (instrumented via
`Worker.prototype.postMessage` override) across 3 repeated runs -- React's commit of the `disabled`
attribute lands synchronously enough, in this browser/React version, that even a same-tick scripted
double-submit never reaches a second `compare()` call. I could not find any UI-reachable path that
hits the `SupersededError` branch at all. This means: the branch itself is confirmed harmless
(verified no unhandled promise rejection, no console/page errors, and the final ranked state is
always correct, exactly as the code already guards for), but its only currently-known trigger is
direct programmatic/test-level reuse of the same client (as in finding 2b above), not the "re-picking
a preset" scenario the comment describes. Not a functional bug -- defensive code that does its job --
but a specific, independently-verifiable mismatch between a comment's claimed trigger and what I could
actually reach, the same pattern the prior review flagged as M1.

**(d) Worker genuinely terminates on unmount, including mid-rank on the slow k5_mixed case -- but
there is currently no way to reach that unmount through the app's own UI.** `CompareRestoration` is
rendered unconditionally inside `Scene` (`src/app/App.tsx:34`) with no route change, conditional
render, or reset-driven remount anywhere in the app, so under normal use it never unmounts in a
running session. I verified the cleanup mechanism itself directly
(`compare_restoration_unmount.test.tsx`, run from a temporary copy under `src/interactions/` and
deleted after): stubbed `global.Worker` with a spy class, rendered `CompareRestoration` for real,
selected "Mixed k=5 (5 down, 120 orders)," clicked Compare (the spy Worker never replies, simulating
a rank genuinely still in flight), then called React's `unmount()`. `terminate()` was called exactly
once, on the right instance, confirming the `useEffect(() => () => workerRef.current?.terminate(),
[])` cleanup (`CompareRestoration.tsx:27`) is mechanically correct. But since nothing in the shipped
app ever unmounts this component, this is currently unreachable/untested-in-situ cleanup code, not a
live resource leak today -- worth flagging so it isn't assumed "covered" if a future router or
conditional-render feature is added without re-checking this path.

### 3. Presets vs. Python `RESTORE` dict: character-for-character match; reference JSON reproducible byte-for-byte

Compared `CompareRestoration.tsx:9-12`'s 4 `PRESETS` against `research/evaluate/add_line_restoration.py`'s `RESTORE` dict directly:

| id | TS `down` | Python `down` | match |
|---|---|---|---|
| island_pocket_plus_line9 | line 36, line 37, line 9 | line 36, line 37, line 9 | yes |
| bus_and_lines | bus 26, line 34, line 9 | bus 26, line 34, line 9 | yes |
| two_buses | bus 11, bus 26 | bus 11, bus 26 | yes |
| k5_mixed | line 36, line 37, line 9, bus 11, line 3 | line 36, line 37, line 9, bus 11, line 3 | yes |

Ran `uv run python -m research.evaluate.add_line_restoration` from scratch and diffed its output
against the committed `verification/REFERENCE_RESULTS/add_line_restoration.json`: **byte-identical**
(`diff` produced no output). The fixture is genuinely current, not stale/regenerated inconsistently.

### 4. Numerical correctness: 2 novel add-line scenarios + 1 novel restoration scenario, independently constructed, all matched exactly

Computed directly via `research/models/oracle.py`'s `solve()`/`rank_restoration()` (never through the
TS engine or UI first), then verified against the real built app:

| Scenario (none in the existing suite) | Oracle | Live UI |
|---|---|---|
| A: add candidate 2 (idx 43, bus5-11) + line 3 capacity x0.30 + bus 14 load x3 | optimal, 0.0 MW unserved, flow on idx 43 = 7.1299 of 65.00 MW | `addline-unserved` = "0.00 MW"; candidate-line-2 aria-label = "...7.13 of 65.00 MW..." ✓ |
| B: add candidate 4 (idx 45, bus7-21) + generator 2 Pmax -> 0 | optimal, 0.0 MW unserved, flow on idx 45 = 7.9405 of 32.00 MW | `addline-unserved` = "0.00 MW"; candidate-line-4 aria-label = "...7.94 of 32.00 MW..." ✓ |

Restoration: constructed a novel down-element set not in any preset (line 40 + bus 20). Python
`rank_restoration` gives 2 orders, best `[1, 0]` at 360.9 MW·steps, second `[0, 1]` at 343.4. Since
this isn't one of the 4 shipped presets, it can't be driven through CompareRestoration's own UI; I
instead called the TS `rankRestoration` engine function directly (same function CompareRestoration's
Worker calls) via a vitest test (`novel_restoration_ts.test.ts`, run from a temporary copy and
deleted after): **exact match** on order count, best/second order, and served_mw_steps (within
0.1 tolerance). This is TS-engine/oracle parity for a scenario this review picked itself, not a
UI-level check (the UI's 4 presets are the only ones reachable through Compare's `<select>`, by
design -- not a gap, just a scope note).

### 5. No fake numbers

`grep -n "Date.now\|Math.random"` across `AddLine.tsx`, `CompareRestoration.tsx`, `lpWorker.ts`,
`lpClient.ts`, `state.tsx`, `NetworkView.tsx`: zero matches.

### 6. Keyboard operability of CompareRestoration (no dedicated e2e test exists yet; driven directly)

`compare_keyboard_probe.mjs`, real `.focus()`/`.press()`, no `.selectOption`/`.click()`:
- Confirmed the already-documented native-`<select>` limitation (CAS-UX-001's note, independently
  re-confirmed by the prior M4-wave review's M10) also applies here: `ArrowDown` on the focused
  `<select>` does not change its value in headless Chromium. Not a new finding, consistent with the
  existing documented scope note.
- `Tab` from the `<select>` reaches the Compare button; `Enter` activates it; the rank completes
  (6 orders for the default preset) with no mouse involvement.
- `Tab` from Compare lands directly on the first ranked-order button (`aria-pressed="true"` on
  focus target confirmed); `Enter` selects it; `cr-chosen-rank` updates correctly.

End to end, CompareRestoration IS keyboard-operable (select preset -- subject to the existing,
already-documented, test-tool-only native-select caveat -- Compare, choose an order), closing the
practical question behind the documented test-coverage gap, independent of whether a formal
Playwright test exists for it yet.

## What I did not find

- No regression in the AddLine fix under any of 90 adversarially-varied timing combinations.
- No case where CompareRestoration's isolation failed to prevent the hang, and no case where sharing
  the queue (my own mutation) failed to reproduce it.
- No stale/inconsistent reference fixture (byte-identical regeneration).
- No numeric mismatch across 2 novel add-line scenarios + 1 novel restoration scenario against the
  oracle.
- No fake numeric source (`Date.now`/`Math.random`) in either file.
- No unhandled promise rejection, console error, or stuck UI state from the `SupersededError` path,
  under the most adversarial resubmission attempt I could construct.
- No keyboard dead-end in CompareRestoration beyond the already-documented, tool-specific native-
  `<select>` limitation.

## Next steps (for the orchestrator, not actioned by me -- this is a review, not a fix pass)

1. Reword `CompareRestoration.tsx:64`'s comment and REQUIREMENTS.yaml's CAS-INT-006 note: the
   `SupersededError` branch's documented trigger ("re-picking a preset mid-rank") does not correspond
   to anything reachable through the rendered UI (both controls are disabled during `'loading'`); the
   branch is confirmed-safe defensive code, but its framing should say so rather than describe an
   unreachable scenario (F1/finding 2c).
2. If a future change makes `CompareRestoration` conditionally rendered or route-based (currently it
   never unmounts in the running app), re-verify the Worker-termination-on-unmount path in situ --
   right now it's only confirmed at the hook/component level with a stubbed Worker, not via any
   reachable real-app trigger (F2/finding 2d).
3. Consider adding the keyboard-only e2e test REQUIREMENTS.yaml already flags as missing for
   CompareRestoration -- this review confirms the control itself supports it end to end, so the test
   would not be chasing a real gap, just formalizing coverage.
