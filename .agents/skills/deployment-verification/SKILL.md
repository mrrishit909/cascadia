---
name: deployment-verification
description: Confirm a project's static build actually resolves on its real deployed URL, with curl plus a real screenshot, not just a successful local build. Use before Gate G5 closes, owned by orchestrator/qa-engineer.
---

# Deployment Verification

**When:** The final step before Gate G5 closes.
**Input:** the deployed GitHub Pages (or equivalent static host) URL.

## Procedure

1. Run the actual production build command and confirm a zero-exit-code build, with the correct base path for the target host.
2. Deploy, then `curl -I` the live URL and confirm a 200 response, not just that the build succeeded locally — a successful build is not a deployment test.
3. Open the live URL in a real browser (not file://) and take a screenshot confirming it actually renders, including asset paths (images/fonts/data fixtures resolving, not 404ing under the deployed base path).
4. Click through at least one of the 6 required controls on the live deployed site specifically, since local-only testing can miss base-path-relative fetch bugs.
5. Record the exact URL, the curl status, and the screenshot path as evidence.

**Output:** curl output + a screenshot of the live deployed page + one live interaction confirmed.
**Failure condition:** marking Gate G5 passed from a local build/preview alone, with no live-URL evidence.
**Recovery:** On a failed live smoke test, check base-path/asset-URL config first (the most common cause), redeploy, and retest the specific failing resource -- don't mark G5 passed on a retry you didn't actually re-run.
