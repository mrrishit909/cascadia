---
name: requirement-coverage
description: Generate verification/REQUIREMENT_COVERAGE.md from a project's specifications/REQUIREMENTS.yaml, showing per-ID status and evidence. Use at any gate checkpoint, owned by orchestrator.
---

# Requirement Coverage Reporting

**When:** At every gate checkpoint (G1-G5), and whenever asked "what's actually done."
**Input:** the project's `specifications/REQUIREMENTS.yaml`.

## Procedure

1. Read every requirement row: ID, priority, status, evidence_paths.
2. Group by status (unstarted / in progress / implemented / tested / independently verified / blocked).
3. For every row claimed `tested` or `independently verified`, confirm the `evidence_paths` entries actually exist and actually support the claim (open them, don't just check the field is non-empty).
4. Count P0 requirements by status; a gate cannot close with any P0 below `independently verified`.
5. Write `verification/REQUIREMENT_COVERAGE.md`: one row per requirement, with a direct link to its evidence.

**Output:** `verification/REQUIREMENT_COVERAGE.md`.
**Failure condition:** a coverage report built by reading only the `status` field, without checking the evidence it points to actually exists and says what it claims.
**Recovery:** A row claiming status it can't back up with real evidence gets reverted to its last honest status, not silently left as-is; report the correction alongside the coverage numbers.
