---
name: math-validation
description: Write and run the independent reference calculator and numerical tests for a project's analytical oracle, before any browser renderer exists. Use at project start by data-ai-engineer, and again by qa-engineer/adversarial-reviewer to re-derive results independently.
---

# Mathematical Validation

**When:** Before any browser code, and again at QA/adversarial review as an independent re-check.
**Input:** the project dossier's "Methods and implementation" line, the Atlas's numerical correctness rules (`docs/extracted/ANALYTICAL_STANDARDS.md`).

## Procedure

1. Implement the reference calculator in Python (pinned via `uv`), independent of any browser code — this is the oracle every control must agree with.
2. Write fixture-based tests for: normal case, boundary case, infeasible/no-solution case, corrupted input, missing input, out-of-domain input.
3. Check the specific invariant the dossier calls out (e.g. CASCADIA: nodal power balance; THE LAST MILE: every stop serviced once, capacity/timing/depot-return accounting).
4. Export versioned, checksummed fixtures binding frontend artifacts to this exact model run.
5. **Second pass (QA/adversarial):** re-run the reference calculator yourself from the committed script, independent of the original run's reported output. If you can't reproduce the claimed numbers, that's a P0 finding.

**Output:** a reference implementation, its test suite (passing), and versioned fixtures.
**Failure condition:** any browser-displayed number without a reference calculation behind it, or a reported result nobody else can reproduce.
**Recovery:** If the independent re-run doesn't reproduce a claimed result, that's a P0 regardless of how close it is -- report the discrepancy and the exact diff, and block the gate until the original author's script or fixtures are corrected.
