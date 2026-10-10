# Data sources

Full machine-readable contract: `specifications/DATA_CONTRACT.yaml`. This file is a human-readable
summary.

## The network: IEEE case30 (real benchmark data)

`public/data/raw-metadata/case30.json`, labeled `REAL_IEEE_BENCHMARK`. Provenance chain:

1. PYPOWER `case30` (https://github.com/rwl/PYPOWER)
2. University of Washington Power Systems Test Case Archive, 30-Bus Power Flow Test Case
   (http://labs.ece.uw.edu/pstca/)
3. Loaded via `pandapower.networks.case30()` (BSD-3-Clause, Kassel/Fraunhofer IEE)

30 buses, 41 lines, real topology, real line ratings (derived: thermal MW = `sqrt(3) * V_from *
max_i_ka`, current limit applied to `|P|`, reactive power ignored). Coordinates are the case's own
schematic layout, not geographic.

## Scenarios: hypothetical counterfactuals

`public/data/scenarios/*.json`, labeled `HYPOTHETICAL_COUNTERFACTUAL`. A scenario is a set of
parameters (removed buses, disabled lines, load/generator overrides) applied to the real case30
topology -- never itself a claim about a real historical event.

## Precomputed fixtures: simulated oracle output

`public/data/precomputed/*.json`, labeled `SIMULATED (oracle output, not observed)`. Every number in
every fixture comes from actually running the oracle (`research/models/oracle.py`,
`scipy.optimize.linprog`, HiGHS method) against a real scenario -- never hand-authored or guessed.

## The solve itself

**Oracle (ground truth):** `scipy.optimize.linprog` (HiGHS method), Python. Formulation: per-island
minimization of `sum(piecewise-linear generator cost) + VOLL * shed`, nodal balance, `|PTDF . injection|
<= rating`, `Pmin <= P <= Pmax`, `0 <= shed <= load`. No global slack bus -- each island balances
independently, which is the whole reason this project uses an island-aware DC-OPF rather than plain DC
power flow (a real, documented high-risk correction from the project's own planning phase: plain DC-PF
cannot express "an island with no generation sheds 100% of its own load," which this grid's own
resilience story depends on).

**Live solver (the app):** the `highs` npm package (MIT-licensed WASM build of the same HiGHS solver
family), running in a browser Web Worker, never the main thread. Same algorithm family as the Python
oracle, not a bit-for-bit reimplementation -- parity tests (`tests/unit/tsPythonParity.test.ts`,
`loadGenParity.test.ts`, `addLineRestorationParity.test.ts`) compare objective value, total shed, and
per-island balance against documented tolerances (see below), not generator-by-generator setpoints
(alternate optima can legitimately differ there).

## Assumptions, stated explicitly (not hidden)

| Assumption | Value/method | Label |
|---|---|---|
| Value of lost load (VOLL) | 1000 EUR/MWh | `SYNTHETIC_ASSUMPTION` -- not in the IEEE data; deliberately far above the real max marginal generation cost (~12 EUR/MWh) so shedding is always a last resort, never a cost-optimal choice over dispatch. |
| Generator cost linearization | 4 equal-width secant segments over `[Pmin, Pmax]` | Overestimates the true quadratic cost by <=0.7% in tests. |
| `Pmin` override conflict | If an overridden `Pmax` falls below `Pmin`, `Pmin` is relaxed to match | Avoids a spurious infeasibility from a UI-driven override alone. |
| Restoration timing | Equal time step per restoration action | `ASSUMED` -- `served_mw_steps` is MW*steps, explicitly NOT MWh; no real crew-dispatch or outage-duration data exists for this. |
| Candidate transmission lines (CAS-INT-004) | 5 synthetic positions, `public/data/raw-metadata/candidate_lines.json` | `SYNTHETIC_ASSUMPTION` -- NOT part of the real case30 topology; labeled as such everywhere they render. |

## Tolerances (`DATA_CONTRACT.yaml`)

| Check | Tolerance |
|---|---|
| Per-island power balance | 1e-6 MW |
| Line thermal limit | 1e-6 MW |
| Objective/shed parity (TS vs. Python) | 1e-3 relative |
| Degenerate solutions | Compared by objective/total-shed/per-island balance, never individual generator setpoints (the LP can have alternate optima) |

## Regenerating fixtures

```bash
uv run python -m research.ingest.export_case30
uv run python -m research.evaluate.n1_sweep
uv run python -m research.export.export_fixtures
```

Every fixture carries its own `sha256` (both a manifest-level file checksum and a payload-level
`data_sha256` inside the file itself), so drift between a regenerated fixture and what the app currently
ships is always detectable.
