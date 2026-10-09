# D1/D2 independent review (fix claimed at ab5901c)

- Reviewer: an adversarial reviewer session, separate from the implementer. Date: 2026-10-09. HEAD: `ab5901c`, clean tree.
- Nothing in the commit message, `e2e/concurrency.spec.ts` or `verification/review_scripts/` was taken as evidence. Every result below was re-derived in this review.
- No application source or implementer test was modified.
- Reviewer scripts are in `verification/d1d2_independent_scripts/`. They need `npm run build && npx vite preview --port 4173`.
- The harness patches `Worker.prototype.postMessage` (in-page init script, test-only). It records the exact scenario each LP request carries, so every claim about request contents comes from the requests themselves, not from UI state.
- Assertions use solver-derived values:
  - line 9's accessible name "of X MW", which is `result.line_rating_mw[9]`;
  - bus 28/29 `data-state`, which comes from `result.islands`;
  - the provenance label.
- Environment: macOS, Node v24.21.0, Playwright 1.64.0 with bundled headless Chromium.

## Verdict

- **D1 as originally reported: FIXED.** I could not reproduce it.
- **D2: FIXED.** The infeasible treatment covers the map and both text panels, and it clears correctly when the network returns to feasible.
- **The D1 fix is incomplete in two ways:**
  - **Scenario model:** `Scen` has no `allow_shed`. This produces new finding N1, rated **P0**. It is pre-existing: it reproduces identically on the pre-fix build. It was not introduced by ab5901c, but it is the same "intent lost on a cross-control action" class.
  - **Mechanism:** `base()` reads `pending` from *rendered* React state. It is not updated synchronously at the point where the intent is created. This leaves a timing window of about 2 ms in which a D1-class loss still happens (N3, P2, reproduced only with machine timing).
- **The prototype checklist item 5 claim is still not clean.** There is a further control/display mismatch (N2, P1) and minor input-loss cases (N4, N5, P2).

### Did the ORIGINAL bugs reproduce against current code?

**D1: NO.** Script: `d1_original.mjs`. I ran 12 combinations: 3 orderings x WASM delays 0 / 300 / 1500 / 4000 ms. All 12 pass on solver-derived values: bus 26 removed, buses 28/29 `shed_no_generation`, line 9 rating 30.40 MW (0.95 x 32), unserved 13.00 MW.
- The Worker request log shows the second request carries both intents in every case: `{"line_capacity_factor":{"9":0.95},"allow_shed":true,"removed_buses":[26]}`.
- Additional sequences:
  - 3 or more mixed actions (removal, then line 9, then line 10, then line 9 again) while the first solve was in flight.
  - Reset followed immediately by a new removal or capacity change.
  - Two resets, each with its own pending removal.
  - In all of these, the removal and the line-9 changes were never lost. The line-10 change in the mixed sequence was dropped, but that is N2/N4 (slider resync), not a D1 recurrence.
- The same original-D1 sequence against a scratch build of the pre-fix commit (`ab5901c~1`, served on :4174) fails. So the harness does detect the bug when it is present.

**D2: NO.** Script: `d2_probe.mjs`. With line 9 at 0.25x and shedding off:
- All 41 lines have `data-binding="n/a"` and all 30 buses have `data-state="infeasible"`.
- 0 line labels contain an MW figure. Labels read "Line 9, flow n/a (infeasible)" and "Bus 6, status n/a (infeasible)".
- The SVG label reads "IEEE case30 network, infeasible: no valid dispatch".
- Both panels show "n/a (infeasible)": `unserved-mw`, `cap-unserved` and `binding-lines`. `cap-flow` is hidden and the RemoveNode shed list is hidden.
- The literal text "0.00 MW" appears nowhere in `<main>`.
- Going back to 1.00x clears everything: 41 slack, 30 served, labels with MW restored, 0 alerts.
- Infeasible combined with a removed bus also renders correctly: 4 dead lines, bus 26 `removed`, the other 29 `infeasible`.
- Screenshots: `verification/SCREENSHOTS/indep-review-D2-infeasible.png`, `indep-review-D2-recovered.png`, `indep-review-D2-infeasible-with-removal.png`.

## New defects

### N1 (P0, Atlas clause "wrong results / fake controls"): removal re-solves with shedding ON while "Allow load shedding" shows OFF

Why P0: the displayed shed MW is computed under a setting that the visible control says is off. For the inputs shown on screen, that is a wrong result. The checkbox is also partly a fake control, because one of the two compute paths ignores it.

Pre-existing: the same script against the pre-fix build (`BASE=http://localhost:4174/ node repro_N1_N2.mjs`) gives the same 16.96 MW and the same request without `allow_shed`. It was not introduced by ab5901c and was not caught by PROTOTYPE_REPORT. Root cause:
- `allowShed` is local state in `AlterCapacity.tsx`.
- It is not part of `Scen` (`src/app/state.tsx:23`).
- `removeBus` never sends `allow_shed` (`state.tsx:128`), so the engine default `true` applies (`src/engine/dcopf.ts:143`).

Repro (`node verification/d1d2_independent_scripts/repro_N1_N2.mjs`):
1. Select line 9.
2. Uncheck "Allow load shedding".
3. Press ArrowLeft x15 (0.25x). Result: "Unserved: n/a (infeasible)", provenance "...line 9 capacity x0.25, shedding disabled".
4. Remove bus idx 2.
   - Result: Unserved **16.96 MW**, "Shed, economic (VOLL): 14.56 MW", checkbox **still unchecked**.
   - Request sent: `{"removed_buses":[2],"line_capacity_factor":{"9":0.25}}`, with no `allow_shed`.
5. Nudge the slider right and back to 0.25x. Now the same displayed scenario (bus 2 removed, line 9 0.25x, shedding disabled) shows **infeasible**.
   - Request sent: `{..."allow_shed":false,"removed_buses":[2]}`.

So the identical visible control state yields two different results depending on the order of actions. Screenshot: `verification/SCREENSHOTS/indep-review-N1-shed-checkbox-off-but-shed-applied.png` (the checkbox is unchecked and the panel shows VOLL shed).

Fix direction: move `allowShed` into `Scen`/`pending` and send it from both `removeBus` and `setCapacity`.

### N2 (P1, by the precedent of D1's own rating: user-visible control state contradicts the applied scenario, until the user moves the control again): capacity slider shows the confirmed factor, not the pending one, after re-selecting a line mid-solve; the displayed value then permanently contradicts the applied scenario

Root cause: the resync effect (`AlterCapacity.tsx:41`) reads `lineCapacity[selectedLine]`, which is the *confirmed* scenario. It ignores `pending`, and it never re-runs when that solve lands.

Repro at WASM delay 1500 ms (the first solve on a cold load):
1. Select line 9.
2. Press ArrowLeft (0.95x).
3. Wait 350 ms. The request is now posted.
4. Select line 10, then select line 9 again.
5. Let it settle. Result: slider and `cap-factor` read **1.00x**, the "32.0 MW rating" text is shown, but line 9 is applied at **30.40 MW** (0.95x, `data-altered=true`).
6. The user then presses ArrowRight, expecting to raise it. The request becomes `{"9":1.05}` from a displayed 1.00x base.

Screenshot: `indep-review-N2-slider-stale-after-reselect.png`.

### N3 (P2, narrow window of about 2 ms): the D1-class loss still occurs when Confirm lands just after the debounce timer fires

Root cause:
- The debounce callback's `dispatch({type:'solving'})` runs outside a discrete event, so React defers its render.
- A Confirm click handled before that render uses the previous render's `removeBus` closure, whose `base()` still sees `pending=null`.
- The removal request is therefore built without the capacity change, and it supersedes the capacity solve.
- The state.tsx comment "set synchronously ... before the async Worker roundtrip" is true of the dispatch. It is not true of what `base()` can observe.

Repro: `node verification/d1d2_independent_scripts/timing_windows.mjs F`. The in-page script sets the slider to 0.95 and clicks the already-visible Confirm 250-252 ms later.
- **CAPACITY LOST in 8 of 9 runs** at offsets 250/251/252 ms.
- Request log: `#1 {"9":0.95}` then `#2 {"removed_buses":[26],"line_capacity_factor":{}}`.
- Final state: bus 26 removed, line 9 rating 32 MW, while the slider shows 0.95x.
- At an offset of 254 ms: 0 of 3 lost (by then Confirm is disabled).

A human would have to click within about 2 ms of the timer firing, so this is rare but not impossible.

Fix direction: keep the in-flight intent in a ref written synchronously inside `removeBus`/`setCapacity`, next to the dispatch, and have `base()` read that ref.

### N4 (P2): inputs dropped or misapplied around line switching

- **Dropped change on quick line switch.** Line 9 ArrowLeft, then selecting line 10 within 250 ms, silently drops the line-9 change: zero Worker requests are posted (`new_races.mjs D_line_switch_in_debounce`). This is the D6 class and is still open.
- **Stale draft carried to the new line.** The resync effect itself runs in the same task as the line-select keydown. I measured this by wrapping `clearTimeout`: it is called within about 2-4 ms, inside that task. But the `setFactor` *state update* inside the effect is rendered later. A slider key pressed before that re-render acts on the old DOM value, which is the previous line's draft.
  - In `new_races.mjs E_multi_action`, the line-10 ArrowRight became `setCapacity(10, 1.00)`, a no-op. Request `#3` carries only `{"9":0.95}`.
  - Reached only at machine speed (Playwright). It is not plausible for a human.

### N5 (P2): a bus selection made during a solve is silently cleared when the solve lands

- The `solved` reducer sets `selectedBus: null` (`state.tsx:65`), and the SVG bus buttons stay operable during `solving`.
- So a bus selected while a capacity solve is in flight loses its confirm group when that solve resolves. Observed 4/4 in `d1_original.mjs` (cap-wait300 path).

### N6 (P2, display): leftover display defects

- Selected-line highlight is missing in the infeasible state: `aria-pressed="true"`, but no highlight stroke is drawn (`NetworkView.tsx:34-40` has no `sel` branch).
- The SVG label says "baseline dispatch" after any feasible capacity-only change (D4 only partly fixed).
- D3 (0-based island indices next to 1-based names, e.g. diagnostic "island [28,29]" beside "Bus 27 unavailable") is still open.
- D5 (duplicate `role="alert"`) is still open.

## Questions answered from code, with the probes that back them

### lpClient supersede timing

- `solve()` rejects every older pending entry **synchronously at call time** (`lpClient.ts:22`), then posts.
- In `removeBus`/`setCapacity`, `dispatch({type:'solving'})` and `solve()` run in the same synchronous tick (`state.tsx:126-128`, `148-150`). There is no gap in which a third action can interleave between the dispatch and the `postMessage`.
- A Worker that is slow to *start* (WASM not yet loaded) just queues messages in FIFO order. Replies whose id is not `latest` are dropped.
- The only gap found is the React render latency described in N3. It is not in lpClient.

### Epoch guard

- **Reset then an immediate new action:** the new action lands, and the stale result never reappears:
  - G1: remove 26 → Reset → remove 5. Result: bus 5 removed, bus 26 served.
  - G2: remove 26 → Reset → line 9 0.95x. The capacity change applied without the removal; the stale removal never reappeared.
- **Two resets each with a pending removal (G3):** the final state is baseline.
- **"Two resets before one stale solve lands":** cannot happen from the UI. Reset becomes disabled right after the first one (observed: `disabled=true`).
- **Reset fired 0-12 ms before the debounce timer** (`timing_windows.mjs R`, 16 runs):
  - Either the timer was cleared, or the stale request was posted and then discarded.
  - **No stuck "Solving..." state and no post-reset change applied.**
- **Reset with a slider change still debouncing (B):** remove 26 (pending), line 9 ArrowLeft, then Reset inside the 250 ms window. The final state is baseline and only the removal request was ever posted. Reset nulls `selectedLine`, and that effect clears the timer. The guard holds.
- **Reset fired exactly as a solve resolves** (`reset_at_resolve.mjs`): Reset clicked right after the Worker reply handler, both as a separate task (like a real click) and as a microtask (before React renders `solved`), after both a removal and a capacity change. Result: **12/12 runs end at baseline.** No other action can land in that instant: Confirm is disabled until the next render, and the slider and checkbox go through the 250 ms debounce.
- **Effect timing:** `epochRef` and `setCapacityRef` are updated in `useEffect`. Measured directly (`effect_timing.mjs`, by wrapping `clearTimeout`), passive effects of a discrete event run in the same task, in a microtask after React's sync render. So a following user event always sees the updated epoch. I found **no** stuck-"Solving..." path. Updating the refs synchronously would still be more robust (it also fixes N3), but this is not a demonstrated defect.

### Removing a second bus

- A second removal *replaces* the first (`removedBus: bus`; single-removal model).
- Confirm is disabled while solving, so two different removals cannot both be in flight from the UI.
- This is a design limitation (N-1 only). It is not a race.

## Scrutiny of `e2e/concurrency.spec.ts`

- **Test count:** it contains **7** tests, not the "8" stated in the commit message. That is 5 `test()` calls, 2 of which sit in a 2-iteration loop.
- **Do the tests detect the bug?** I ran an unmodified copy against the pre-fix build (:4174), via a scratch config in `verification/d1d2_independent_scripts/e2e_scratch/`.
  - The 4 race tests and the reset test **fail** on pre-fix code, so they do detect the original bug.
  - "multiple rapid capacity changes" and "solve failure" **pass** on pre-fix code, so they are not D1 regression tests.
- **Mislabeled test:** "capacity change then removal while capacity solve is in flight" never puts a capacity solve in flight.
  - The removal is confirmed inside the 250 ms debounce window. The Worker log shows the **removal is posted first** (`#1 removed_buses:[26]`, `#2 {9:0.95, removed 26}`), so at the solve level it is the same ordering as the other test.
  - My variant V2 waits 300 ms so the capacity request is truly in flight. In that case **Confirm is disabled**, and V2 fails on `toBeEnabled`.
  - So the ordering "capacity solve in flight, then removal" is prevented by the disabled guard, not handled by the fix, and the test title overclaims.
- **Weak assertions:**
  - The race tests' "0.95x" check reads the local slider draft.
  - `data-altered` reads `state.lineCapacity`.
  - The only solver-derived assertion is `13.00 MW`, which is identical whether or not 0.95x was applied.
  - The rapid-changes test never checks that 0.75x was the *applied* value.
  - My variants add the solver-derived checks: V1 asserts line 9 "of 30.40 MW" at delays 50/250/300/600/3000 ms; V3 asserts "of 24.00 MW". **All pass on HEAD.**
- **Scope of the WASM delay:** it slows only the *first* solve, because WASM loads once per Worker. The tests therefore say nothing about races between two later, fast solves.
- **Flakiness:** an unmodified copy run with `--repeat-each 5 --workers 4` gave **35 passed**, with no flakes observed.

## Real test-suite numbers (run in this review)

| Command | Exit | Printed result |
|---|---|---|
| `uv run pytest -q` | 0 | `15 passed in 0.47s` |
| `npm run test` (Vitest) | 0 | `Test Files 4 passed (4)`, `Tests 10 passed (10)`. Re-run after the reviewer scratch specs were added, with the same result, so Vitest does not collect them. |
| `npm run build` | 0 | built (`tsc -b && vite build`) |
| `npx playwright test` (production preview; port 4173 was free beforehand) | 0 | **`8 passed`** (7 in concurrency.spec.ts + 1 keyboard spec); 0 failed, 0 skipped |
| Reviewer scratch: orig copy + variants vs HEAD | 1 | 13 passed, 1 failed (V2, by design: shows the mislabeled test) |
| Reviewer scratch: orig copy + variants vs pre-fix build | 1 | 3 passed, 11 failed (expected: the bug is present) |

The expected total of 9 e2e tests is wrong. The real count is **8**.

## Next steps

1. Fix N1 (P0): add `allowShed` to `Scen`/`pending` and send it from `removeBus`.
2. Fix N2: make the slider resync read `pending ?? confirmed`, and re-sync when a solve lands for the selected line.
3. Fix N3: hold the in-flight intent in a ref written synchronously in `removeBus`/`setCapacity`.
4. Rename or rewrite the mislabeled e2e test, and add solver-derived assertions (line rating in the aria-label).
5. Add an e2e test for N1: shedding off, then remove a bus, then assert the result is still infeasible or the checkbox state is honored.
