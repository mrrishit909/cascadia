---
name: spec-extraction
description: Convert a project's docs/projects/PROJECT_NN.md dossier into atomic, testable requirement rows before any implementation starts. Use at the very start of a project, before Gate G1.
---

# Spec Extraction

**When:** First thing when starting a new project, before any code.
**Input:** `docs/projects/PROJECT_NN.md` (or a moonshot spec), `specifications/REQUIREMENTS.yaml` (the 6 rows already seeded for this project from the Atlas extraction).

## Procedure

1. Read the project's 6 rows in `specifications/REQUIREMENTS.yaml` — these are the P0 interaction requirements, already ID'd (`<NS>-INT-00N`).
2. For each, fill in the full contract fields the Atlas requires (`docs/extracted/EXECUTION_PROTOCOL.md`, "Requirements are versioned contracts"): given/when/then, verification method, evidence location, owner.
3. Add requirement rows for the 6 chapters (motion/narrative, not just interaction) and the 5 acceptance gates already listed in the dossier's "Acceptance gates" table — these need IDs too (`<NS>-MOTION-001`, `<NS>-RELEASE-001`, etc., already present in the dossier).
4. Copy the finished set into the new project's own `specifications/REQUIREMENTS.yaml`.
5. Flag anything ambiguous or missing as an open decision rather than silently assuming.

**Output:** a complete `specifications/REQUIREMENTS.yaml` for the project, every row status `unstarted`.
**Failure condition:** any P0 requirement without an owner or an observable pass/fail assertion. Do not proceed to Gate G1 until fixed.
**Recovery:** An ambiguous requirement gets a documented conservative assumption only if reversible and factually safe (per EXECUTION_PROTOCOL.md's change-control rule); otherwise flag it as an open decision for the user rather than guessing.
