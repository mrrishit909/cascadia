# Prototype Gate Re-evaluation

Follows the original `verification/PROTOTYPE_REPORT.md` (verdict: NOT MET, D1/D2 found) and
`verification/D1_D2_INDEPENDENT_REVIEW.md` (D1/D2 confirmed fixed, N1/N2/N3 found). This document
re-runs `docs/planning/cascadia/PROTOTYPE_ACCEPTANCE_CRITERIA.md`'s checklist after all five
defects (D1, D2, N1, N2, N3) were fixed, at commit `5288178`, clean tree.

## Checklist, re-run fresh for this document

| # | Item | Result | Fresh evidence (this run) |
|---|---|---|---|
| 1 | N-1 parity sweep | **MET** | `verification/REFERENCE_RESULTS/ts_python_parity.json`: 195/195 pass. Max objective relative delta 7.82e-15, max shed relative delta 8.88e-15 (tolerance 1e-3 for both). Max per-island balance 2.84e-14 MW (tolerance 1e-6 MW). |
| 2 | Per-island balance | **MET** | Independent per-bus check (`node verification/review_scripts/island_check.mjs`, does not use the engine's own `balance_mw` field): 198/198 scenarios pass, worst per-bus nodal imbalance 7.53e-13 MW. |
| 3 | Keyboard-only e2e | **MET** | `npm run build && npm run test:e2e`: 10/10 passed, including `e2e/cas_substation_remove_keyboard.spec.ts` (0 pointer/mouse calls, grep-confirmed) and 9 tests in `e2e/concurrency.spec.ts`, all keyboard-only. |
| 4 | Exact reset | **MET** | `src/app/resetAndInterrupt.test.tsx`: both reset tests pass, comparing full `AppState` deep-equality excluding only the `epoch` bookkeeping counter (which legitimately changes on every reset by design -- the mechanism that makes reset race-safe, documented in `state.tsx`). |
| 5 | Interruption safety | **MET, exceeded** | Original requirement: one test, two rapid inputs, only the latest result renders. Now covered by 2 unit tests (`resetAndInterrupt.test.tsx`) plus 9 real-Worker e2e tests in `e2e/concurrency.spec.ts`: both race orderings at 2 WASM-load delays, a genuinely-in-flight-solve block test, reset-during-solve, rapid multi-input convergence, and solve-failure-then-recovery. All against the real browser, real Worker, real WASM -- not mocks. |
| 6 | No fake numbers | **MET** | `grep -rn "Date.now()\|Math.random()" src/`: 0 matches. |

**All 6 items MET**, each with evidence re-derived fresh for this document, not carried over from an earlier claim.

## Defects closed since the original NOT MET verdict

| ID | Severity | Found by | Status |
|---|---|---|---|
| D1 | P1 | Original adversarial review | **Fixed** (`pending` scenario intent, read synchronously via `pendingRef`) |
| D2 | P1 | Original adversarial review | **Fixed** (explicit infeasible treatment in `NetworkView.tsx`, both text panels) |
| N1 | P0 | Independent review of the D1/D2 fix | **Fixed** (`allowShed` added to the shared `Scen` type, sent by `removeBus`) |
| N2 | P1 | Independent review | **Fixed** (slider/checkbox resync scoped to the request's own line, reads pending) |
| N3 | P2 | Independent review | **Fixed** (`pendingRef` written synchronously at the dispatch call site) |

All five were independently re-verified against the fix using either the original reviewer's own
scripts (`verification/d1d2_independent_scripts/`) re-run against current code, or a fresh
independent adversarial-reviewer session (`verification/D1_D2_INDEPENDENT_REVIEW.md`) that
reproduced the ORIGINAL bugs against a pre-fix build first, to prove its own test harness
actually detects them, before confirming none reproduce on current code.

## Known remaining items (not blocking, explicitly out of prototype scope or P2/cosmetic)

- N4 (P2): a capacity change dropped if the user switches lines inside the 250ms debounce window, reachable only at machine speed per the independent reviewer's own assessment ("not plausible for a human").
- N5 (P2): a selected-but-not-yet-confirmed bus is deselected when an unrelated solve resolves.
- N6 (P2, display): selected-line highlight missing in the infeasible state; SVG label doesn't update after a capacity-only change.
- D3 (P2, pre-existing): bus numbering mixes 0-based diagnostic indices and 1-based display names.
- D5 (P2, pre-existing): the infeasible alert is announced twice (once per panel) to screen readers.
- R2: `CAS-DATA-001`'s underlying IEEE/UW benchmark license text (distinct from pandapower's own confirmed BSD-3) still wasn't located.
- R3: `npm run lint` has 5 pre-existing warnings (4 in test files, 1 `only-export-components` in `state.tsx`), not evaluated as part of this gate.

None of these block the prototype checklist above, and none involve wrong results, lost
confirmed user intent, or fake controls -- the standard the P0/P1 items above were held to.

## Verdict

**Prototype acceptance criteria: MET.**

Per `PROTOTYPE_ACCEPTANCE_CRITERIA.md`'s own scope note, this is the smallest complete slice (2 of
7 interactions, no motion, no deployment), not a complete CASCADIA implementation. The project is
ready to proceed to M4 per `IMPLEMENTATION_PLAN.md`'s task graph: the remaining 5 interactions
(CAS-INT-002/003/004/006/007) and motion choreography for all 6 chapters, followed by M5 (full
QA: the evidence harness at 1440/768/390, axe, Lighthouse, frame pacing) and M6 (deployment).
