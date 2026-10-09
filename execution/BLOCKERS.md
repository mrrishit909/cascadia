# Blockers

None currently.

## Open, low priority

- Minor cosmetic bug in cas_int_001_control: the debug/status line reads "bus 1 removed" while the main result correctly shows "Bus 2 unavailable" for the same action (off-by-one or stale-label issue in the Worker-call debug text, not the actual computed result). Confirmed via verification/SCREENSHOTS/cas-int-001-keyboard-remove.png. Low priority, doesn't affect correctness of the displayed MW value. Track for a later cleanup pass.

## Resolved

- ~~P1: infeasible solves showed "0.00 MW" instead of a non-numeric diagnostic (readable as "fully served")~~ -- fixed in `src/interactions/RemoveNode.tsx` and `AlterCapacity.tsx`: when `r.status === 'infeasible'`, the unserved/binding-lines fields now render `n/a (infeasible)` instead of formatting the (meaningless, in this case) zero values. Found by `no_fake_numbers_audit`'s adversarial review (`verification/NO_FAKE_NUMBERS_AUDIT.md` #6), fixed by the orchestrator before the final acceptance report ran. Build and full test suite (10 vitest + 1 e2e) reconfirmed clean after the fix.
