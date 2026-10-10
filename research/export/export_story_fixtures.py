"""Regenerate the 3 chapter "story" precomputed fixtures (CHAPTER_ARCHITECTURE.md section 1: scroll-driven
chapters show these fixed, oracle-derived states and NEVER call the live solver). Companion to
export_fixtures.py (same Precomputed envelope), kept separate so it doesn't touch the 3 canonical
fixtures' own generator script. One command: uv run python -m research.export.export_story_fixtures
"""
import hashlib
import json
import pathlib

from research.models.oracle import N_SEG, VOLL, solve

ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / "public/data"
sha = lambda b: hashlib.sha256(b).hexdigest()

TODAY = "2026-10-09"

# No ART_DIRECTION.md scenario is named for these 3 beats (confirmed undocumented, not an oversight to
# fix). Each choice below is recorded in its own fixture's `meta` block per the project's standing rule.
ORACLE_SCENARIOS = {
    "intro_fault_line33": dict(
        params={"disabled_lines": [33]},
        meta=dict(
            scenario="Line 33 outage (disabled_lines=[33], allow_shed=true default)",
            why="Chosen for ART_DIRECTION.md's intro beat-4 fault (9-12s, 'one preset line opens with a "
                "kerf gap'). Line 33 is already the subject of e2e/newControls.spec.ts's 'N1/D2 for line "
                "outage' test (infeasible when shedding disallowed, optimal when allowed) -- reusing it "
                "keeps the intro consistent with what the lab lets a user later explore. Cross-checked "
                "against verification/REFERENCE_RESULTS/n1_sweep.json case_id=line_outage_33 "
                "(objective=4053.619625, total_shed=3.5, n_islands=2) before trusting this fresh run.",
            chosen_on=TODAY,
        ),
    ),
    "ch4_fault_bus26": dict(
        params={"removed_buses": [26]},
        meta=dict(
            scenario="Substation (bus) 26 removal (removedBus=26, allow_shed=true default)",
            why="Chosen for ART_DIRECTION.md section 3's chapter 4 ('outage cascades') row and the "
                "lines 116-119 single-shot rule. Bus 26 is the most-tested bus removal in the suite "
                "(verification/REFERENCE_RESULTS/n1_sweep.json case_id=bus_removal_26; "
                "e2e/cas_substation_remove_keyboard.spec.ts, e2e/concurrency.spec.ts) -- reusing it "
                "keeps the chapter's narrative aligned with already-verified numbers. Cross-checked "
                "against n1_sweep.json (objective=13529.01875, total_shed=13.0, n_islands=2) before "
                "trusting this fresh run.",
            chosen_on=TODAY,
        ),
    ),
}


def main():
    case_bytes = (D / "raw-metadata/case30.json").read_bytes()
    case = json.loads(case_bytes)
    oracle_sha = sha((ROOT / "research/models/oracle.py").read_bytes())
    for sid, s in ORACLE_SCENARIOS.items():
        res = solve(case, json.loads(json.dumps(s["params"])))
        pc = dict(
            id=sid,
            label="SIMULATED: island-aware DC-OPF oracle output (not observed data)",
            oracle="research/models/oracle.py",
            oracle_sha256=oracle_sha,
            generator="research/export/export_story_fixtures.py",
            seed=None,
            deterministic=True,
            limitations=[
                "DC approximation, lossless, no voltage/reactive limits",
                "quadratic generator costs piecewise-linearised (4 segments)",
                "VOLL=1000 EUR/MWh assumed",
                "single-shot response, no cascading trips",
            ],
            meta=dict(s["meta"], params=s["params"], voll_eur_per_mwh=VOLL, cost_segments=N_SEG),
            result=res,
        )
        (D / f"precomputed/{sid}.json").write_text(json.dumps(pc, indent=1, sort_keys=True))
        print(sid, "objective=", res["objective"], "total_shed=", res.get("shed_economic_mw", 0) + res.get("shed_no_generation_mw", 0))

    # Fixture 3: chapter 5 "recovery plans". NOT a fresh oracle run -- trimmed from the already
    # oracle-verified verification/REFERENCE_RESULTS/add_line_restoration.json (pinned by
    # e2e/compareRestoration.spec.ts), per the task instruction to reuse rather than re-derive.
    ref = json.loads((ROOT / "verification/REFERENCE_RESULTS/add_line_restoration.json").read_text())
    case = next(c for c in ref["restoration_cases"] if c["case_id"] == "island_pocket_plus_line9")
    top3 = case["ranking"][:3]  # CompareRestoration.tsx's PRESETS[0] (the default); ranking is already
    # sorted best-first by rankRestoration/restoration_cases' own generator (served_mw_steps desc,
    # ties broken lexicographically) -- slicing the first 3 entries IS "top 3 ranked orders".
    ch5 = dict(
        id="ch5_restoration_island_pocket_plus_line9",
        label="SIMULATED: island-aware DC-OPF oracle output over a HYPOTHETICAL fault scenario (not observed data)",
        oracle="research/models/oracle.py",
        generator="research/export/export_story_fixtures.py",
        source_reference="verification/REFERENCE_RESULTS/add_line_restoration.json",
        source_reference_sha256=sha((ROOT / "verification/REFERENCE_RESULTS/add_line_restoration.json").read_bytes()),
        seed=None,
        deterministic=True,
        limitations=[
            "DC approximation, lossless, no voltage/reactive limits",
            "quadratic generator costs piecewise-linearised (4 segments)",
            "VOLL=1000 EUR/MWh assumed",
            "served_mw_steps assumes one equal time step per restoration action (no crew/duration data)",
        ],
        meta=dict(
            scenario="CompareRestoration.tsx PRESETS[0] 'island_pocket_plus_line9': lines 36, 37, 9 down "
                     "(3 elements), restored one at a time -- top 3 of its 6 enumerated restoration orders "
                     "by served_mw_steps.",
            why="ART_DIRECTION.md section 3's chapter 5 row calls for 'three equal columns (small "
                "multiples), one per restoration sequence from the fixture' -- read as one fault "
                "scenario's top-3 ranked restoration orders (not three different fault scenarios), "
                "matching reference R4's inspiration note ('several alternative states of ONE system "
                "drawn on the same base geometry'). island_pocket_plus_line9 is PRESETS[0], the control's "
                "own default, already pinned by e2e/compareRestoration.spec.ts.",
            chosen_on=TODAY,
            down=case["down"],
            n_orders_total=case["n_orders"],
        ),
        case_id=case["case_id"],
        base=case["base"],
        down=case["down"],
        n_orders_total=case["n_orders"],
        ranking=top3,
    )
    (D / "precomputed/ch5_restoration_island_pocket_plus_line9.json").write_text(json.dumps(ch5, indent=1, sort_keys=True))

    # Merge-only: add entries for just the 3 new files into the existing manifest, untouched otherwise.
    # (NOT regenerating the whole manifest via export_fixtures.main() -- that would also rewrite
    # baseline/infeasible/islanding's recorded oracle_sha256 to the CURRENT oracle.py hash, which
    # differs from what's already committed there; that pre-existing drift predates this task and is
    # out of scope to fix here -- see the handback report.)
    man_path = D / "provenance/manifest.json"
    man = json.loads(man_path.read_text())
    for sid in (*ORACLE_SCENARIOS, "ch5_restoration_island_pocket_plus_line9"):
        p = D / f"precomputed/{sid}.json"
        man["files"][f"precomputed/{sid}.json"] = sha(p.read_bytes())
    man["files"] = dict(sorted(man["files"].items()))
    man_path.write_text(json.dumps(man, indent=1))
    print(json.dumps(man, indent=1))


if __name__ == "__main__":
    main()
