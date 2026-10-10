# CASCADIA

An electrical-grid resilience visualization. The IEEE case30 network, rendered as one persistent
engraved-plate SVG stage, fractures, reroutes and reconstructs under a real island-aware DC-OPF solve
as the reader scrolls through an intro and six chapters, and experiments directly with 7 interactive
controls in a scenario laboratory.

Project #1 of the Creative Engineering Atlas. See `CLAUDE.md` for the full project contract and
precedence order, and `execution/PROGRESS.md` for the complete build history.

## What's real, what's simulated

Every one of the 7 controls (remove a substation, increase load, reduce a generator, alter a line's
thermal capacity, disable a line, add a candidate transmission line, compare restoration sequences)
triggers a REAL linear-programming solve: `scipy.optimize.linprog` (HiGHS method) in Python as the
independent oracle, and the `highs` WASM build of the same solver family running in a browser Web
Worker for the live app. Nothing displayed is interpolated from animation progress or randomly
generated -- see `LIMITATIONS.md` for the specific, honestly-documented places where a simplification
was made (and why), and `DATA_SOURCES.md` for the full data provenance chain.

## Quickstart

```bash
npm install
npm run dev          # dev server, http://localhost:5173
npm run build         # production build (tsc -b && vite build)
npm run preview        # serve the production build locally
```

Python oracle / analytical tests (uses `uv`; see `research/` for the oracle itself):

```bash
cd /path/to/cascadia
.venv/bin/python -m pytest -q
```

## Test suites

```bash
npm run test          # Vitest: unit + component + analytical-parity tests
npm run test:e2e        # Playwright: real production build, real Worker/WASM, no mocks
npx tsc --noEmit        # typecheck
```

See `TESTING.md` for what each suite actually covers and how evidence is captured.

## Documentation map

- `CLAUDE.md` -- project rules, resolved architecture decisions, hard constraints.
- `ARCHITECTURE.md` -- system design: the persistent stage, shared GSAP lifecycle, camera ownership,
  state management.
- `VISUAL_DESIGN.md` -- the design system (palette, type, motion tokens) and how it's applied.
- `MOTION_SYSTEM.md` -- the intro + per-chapter choreography, as actually built.
- `DATA_SOURCES.md` -- where the network data and every computed result come from.
- `TESTING.md` -- test suite breakdown and how to reproduce the evidence in `verification/`.
- `LIMITATIONS.md` -- every known, deliberate simplification, honestly stated.
- `DEPLOYMENT.md` -- build and static-hosting instructions.
- `execution/PROGRESS.md` -- the full, chronological build log (every bug found, every fix, every
  milestone commit).
- `verification/` -- real evidence: screenshots, performance measurements, independent review reports.
- `docs/ART_DIRECTION.md` -- the full creative/motion specification this build follows.
