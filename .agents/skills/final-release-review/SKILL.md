---
name: final-release-review
description: The last check before a project is declared done -- re-verify all five release gates with real evidence, independent of whoever built the feature. Use once per project, right before publishing the case study, owned by adversarial-reviewer.
---

# Final Release Review

**When:** The single gate before a project is called finished and published to the portfolio.
**Input:** `verification/REQUIREMENT_COVERAGE.md`, all `verification/SCREENSHOTS/`, the deployed URL.

## Procedure

1. Walk the five gates one more time, independently of the agent that last worked the project (per `docs/extracted/EXECUTION_PROTOCOL.md`):
   - G1 Spec lock: no ambiguous/unowned P0 requirement remains.
   - G2 Analytical truth: re-run the reference calculator yourself; confirm it matches what's displayed.
   - G3 Functional build: click all 6 controls yourself on the real build; confirm none is decorative.
   - G4 Creative verification: open every screenshot yourself; confirm 6 visually distinct chapters x 3 real breakpoints.
   - G5 Release evidence: curl the live URL yourself; confirm the deployed smoke test.
2. Run the Atlas's final production checklist (`docs/extracted/QUALITY_REQUIREMENTS.md`) line by line.
3. Check the case study (if written) only claims verified metrics, with limitations stated honestly, and no fabricated client/testimonial content.
4. Write the final response in the Atlas's required format: scope delivered | requirement counts by status | build/test commands + exit status | numerical benchmark results | screenshot locations | accessibility/performance environments | deployed smoke-test evidence | open risks/defects | exact next steps.

**Output:** the final response report above, or a list of blocking gaps if not actually ready.
**Failure condition:** declaring a project done based on anyone's self-report, including your own prior pass, without re-deriving the G1-G5 evidence yourself in this review.
**Recovery:** Any gate that fails re-verification goes back to its owning agent with the specific unmet evidence named; do not re-run final-release-review until that agent reports the gap closed, and never downgrade a finding to pass it through.
