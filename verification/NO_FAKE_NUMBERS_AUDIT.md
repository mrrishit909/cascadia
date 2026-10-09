# No-Fake-Numbers Audit (CLAUDE.md hard rule)

Rule: "Never derive a displayed numeric value from `Date.now()`, `Math.random()`, or animation progress."

Audited: 2026-10-09, commit 307a5b5 (working tree: only `execution/TASK_QUEUE.json` modified, no `src/` changes).
Reviewer: adversarial reviewer agent (independent of the build agents).

## 1. Required grep

```
$ grep -rn "Date.now()\|Math.random()" src/
(no output, exit 1)
```

**Total matches: 0. SAFE: 0. VIOLATION: 0.**

There are no per-match rows to fill in because the required grep returned nothing. To make sure the
zero was not a lucky miss, the search was widened (sections 2 and 3).

## 2. Widened source search (other nondeterministic or time/animation sources)

```
$ grep -rnE "random|Date|performance\.now|requestAnimationFrame|setInterval|setTimeout|crypto|progress|tween|lerp|spring" src/
```

| File:line | Snippet | Verdict |
|---|---|---|
| src/interactions/AlterCapacity.tsx:16 | `const timer = useRef<ReturnType<typeof setTimeout>>(undefined)` | SAFE, cosmetic only. Holds the debounce timer handle. No number shown. |
| src/interactions/AlterCapacity.tsx:18 | comment: `...would fight an in-progress drag` | SAFE. Comment text that contains the word "progress". Not code. |
| src/interactions/AlterCapacity.tsx:30 | `timer.current = setTimeout(() => { void setCapacity(selectedLine, f, shed) }, DEBOUNCE_MS)` | SAFE, cosmetic only. A 250 ms debounce decides *when* the real Worker solve runs. It never sets a displayed value. |
| src/workers/lpWorker.test.ts:31 | `setTimeout(() => worker.onmessage?.(...), 0)` | SAFE. Test-only mock that makes the fake worker reply asynchronously. Not shipped. |

No `performance.now`, `requestAnimationFrame`, `crypto`, tween/lerp/spring, or animation-progress code exists in `src/`.
None of the three display components (`RemoveNode.tsx`, `AlterCapacity.tsx`, `NetworkView.tsx`) contains any animation code.

## 3. Production bundle check (dist/, built 2026-10-09 01:52, newer than the last src edit at 01:51)

`grep -E "Math\.random|Date\.now" dist/assets/*` matches two files. All matches are third-party internals:

| Bundle | Origin | Verdict |
|---|---|---|
| dist/assets/lpWorker-*.js | HiGHS Emscripten runtime: in-memory FS `atime/mtime/ctime = Date.now()` (about 15 sites) and `rt=()=>Date.now()` (the clock shim HiGHS uses for its time limit and log timer) | SAFE. These are file timestamps and a solver wall clock. The LP solution does not depend on them unless a time limit is hit, and none is set. |
| dist/assets/index-*.js | React DOM: `Math.random().toString(36)` builds the `__reactFiber$` and `_reactListening` key suffixes; `e.timeStamp \|\| Date.now()` is the synthetic event timestamp | SAFE. Framework internals. They never reach rendered data. |

## 4. Manual trace: CAS-INT-001 (remove substation), from the DOM back to solve()

1. **DOM**: `src/interactions/RemoveNode.tsx:38` renders `<strong data-testid="unserved-mw">{mw(r.total_unserved_mw)}</strong>`.
   `mw` is just `v.toFixed(2) + " MW"` (line 5). The breakdown lines 42-44 use `r.unserved_removed_mw`, `r.shed_no_generation_mw`
   and `r.shed_economic_mw` from the same object.
2. `r = result.result` (line 13), where `result = state.result` comes from the `useApp()` context.
3. **State**: `src/app/state.tsx:38`. Only the `solved` action replaces `result` with a solve output; `loaded` and `reset`
   set it to the baseline fixture object `public/data/precomputed/baseline.json`, which the UI labels as such.
4. **Dispatch**: `state.tsx:87-98` `removeBus(bus)` calls `await solve(state.network, { removed_buses: [bus], ... })` and then
   dispatches `solved` with `result: r`, passing `r` through without changing it. No arithmetic happens in between.
5. **Solver binding**: `state.tsx:51-56` `workerSolver()` builds `new Worker(lpWorker.ts)` behind `createLpClient`.
6. **Client**: `src/workers/lpClient.ts:13-24` posts `{id, case, scenario}`. It resolves with `data.result` only when
   `data.id === latest`; superseded replies are dropped. No values are synthesized here.
7. **Worker**: `src/workers/lpWorker.ts:14-21` calls `solveDcopf(c, await highs, scenario)` and posts the return value as is.
8. **Engine**: `src/engine/dcopf.ts:206-207` computes `total_unserved_mw = unservedRemoved + shedNoGen + shedEcon`.
   `unservedRemoved` is the load at the removed buses (line 171). `shedNoGen` is the load of islands with no generation
   (lines 178-185, no LP is run for those islands). `shedEcon` is the sum of the LP shed variables `x[nG+j]` read from
   HiGHS `Columns[...].Primal` (lines 125, 130, 193).

Conclusion: the displayed unserved MW is a real solver output from end to end. Nothing on this path is time-based, random,
or a placeholder.

The binding-status display for CAS-INT-005 was traced the same way: `AlterCapacity.tsx:58` `r.binding_lines`, then
`dcopf.ts:205`, which takes `|flow| >= rating - 1e-6`, where flows = PTDF x LP injections (line 134). `NetworkView.tsx:27`
reads `result.binding_lines` and does not compute anything itself.

## 5. Independent re-derivation (not trusting the repo's own tests)

- Ran `src/engine/dcopf.ts` directly under Node 24 with the real `highs` WASM. Ran `research/models/oracle.py`
  (scipy linprog/HiGHS, a separate implementation) on the same 38 scenarios: all 30 single-bus removals,
  line 9 at x0.1/0.25/0.5/1.5/2.0, line 9 at x0.25 with shedding disabled, a two-line derate, and bus 5 removal plus a line derate.
  **Result: 38/38 agree on status, total unserved MW (<1e-6), binding-line set, and objective (rel 1e-4).**
  Examples: remove bus 26 gives 13.00 MW shed_no_generation (island [28,29]). Line 9 at x0.5 gives binding [9,28,29] and 5.2996 MW shed.
- Islanding limitation ("islands must not silently draw power"): for the bus-24 and bus-26 removals, the islands with no
  generation ([25] and [28,29]) carry no flow and no generation, and all of their load is reported as `shed_no_generation`. **Enforced, not just documented.**
- `npx vitest run`: 4 files, 10 tests passed, exit 0.
- `npx playwright test e2e/cas_substation_remove_keyboard.spec.ts` against `npm run preview` (production build, real
  browser Worker and WASM, no injected solver): 1 passed, exit 0. In this run the DOM `unserved-mw` text equals the oracle's `n1_sweep.json` total_shed.

## 6. Finding outside this rule (not a Date/random violation; flagged for an owner decision, not fixed)

**P1: an infeasible solve still shows confident zero numbers.** For line 9 at x0.25 with "Allow load shedding" unchecked, the
engine returns `status: 'infeasible'`, `total_unserved_mw: 0`, `binding_lines: []`. The UI does show the
`role="alert"` "Infeasible: ..." diagnostic. However, `AlterCapacity.tsx:58-60` also shows "Binding lines: none | Unserved: 0.00 MW | Line 9 flow: 0.00 MW"
(the infeasible island has no flows, so `?? 0` fills in a zero). Both panels render the same shared `state.result`, so `RemoveNode.tsx:38-44`
shows "Unserved: 0.00 MW" plus a zero breakdown too.
These numbers are real engine outputs, but they describe a dispatch that does not exist. A reader can take "0.00 MW unserved"
to mean "fully served". Suggested fix (needs an intent decision on the wording): when `r.status === 'infeasible'`, render
"n/a (infeasible)" in place of the MW and binding values. This was left unfixed on purpose.
