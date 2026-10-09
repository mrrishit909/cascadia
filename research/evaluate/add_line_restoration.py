"""CAS-INT-004 (add line) + CAS-INT-006 (restoration) reference vectors. Writes verification/REFERENCE_RESULTS/add_line_restoration.json.
TS parity: npx vitest run tests/unit/addLineRestorationParity.test.ts"""
import json, pathlib, sys
from research.models.oracle import solve, load_candidates, rank_restoration, TOL, VOLL, N_SEG
from research.evaluate.n1_sweep import invariants

ROOT = pathlib.Path(__file__).resolve().parents[2]
CASE = json.load(open(ROOT / "public/data/raw-metadata/case30.json"))
CANDS = load_candidates()
CONTEXTS = {"healthy": {}, "line9_cap_x0.5": {"line_capacity_factor": {9: 0.5}}, "bus26_removed": {"removed_buses": [26]},
            "line9_x0.25_noshed": {"line_capacity_factor": {9: 0.25}, "allow_shed": False}}
RESTORE = {  # name -> (base scenario, down elements)
    "island_pocket_plus_line9": ({}, [dict(kind="line", id=36), dict(kind="line", id=37), dict(kind="line", id=9)]),
    "bus_and_lines": ({}, [dict(kind="bus", id=26), dict(kind="line", id=34), dict(kind="line", id=9)]),
    "two_buses": ({}, [dict(kind="bus", id=11), dict(kind="bus", id=26)]),
    "k5_mixed": ({}, [dict(kind="line", id=36), dict(kind="line", id=37), dict(kind="line", id=9), dict(kind="bus", id=11), dict(kind="line", id=3)]),
}


def add_cases():
    for cn, ctx in CONTEXTS.items():
        for k in range(len(CANDS)): yield f"add_{k}_{cn}", {**ctx, "added_lines": [k]}
        yield f"add_all_{cn}", {**ctx, "added_lines": list(range(len(CANDS)))}


def main():
    rows = []
    for cid, sc in add_cases():
        r = solve(CASE, sc); bad = invariants(r) if r["status"] == "optimal" else []
        rows.append(dict(case_id=cid, scenario=sc, status=r["status"], objective=r["objective"], total_shed=r["total_unserved_mw"],
                         n_islands=len(r["islands"]), per_island_balance=[i["balance_mw"] for i in r["islands"]],
                         binding_lines=r["binding_lines"], pass_invariants=not bad, violations=bad))
    rest = []
    for name, (base, down) in RESTORE.items():
        rk = rank_restoration(CASE, down, base=base)
        rest.append(dict(case_id=name, base=base, down=down, n_orders=len(rk), ranking=rk))
    meta = dict(generator="research/evaluate/add_line_restoration.py", deterministic=True, seed=None, voll=VOLL, cost_segments=N_SEG, tolerance_mw=TOL,
                label="SIMULATED (oracle output on REAL_IEEE case30 + SYNTHETIC candidate lines + HYPOTHETICAL restoration scenarios)",
                restoration_metric="served_mw_steps: sum of served MW over states 0..k-1, one equal time step per restoration (MW*steps, not MWh)")
    out = ROOT / "verification/REFERENCE_RESULTS/add_line_restoration.json"
    out.write_text(json.dumps(dict(meta=meta, candidates=CANDS, add_line_cases=rows, restoration_cases=rest), indent=1))
    print("add cases", len(rows), "invariant fails", sum(not r["pass_invariants"] for r in rows), "restoration cases", len(rest),
          {c["case_id"]: (c["n_orders"], round(c["ranking"][0]["served_mw_steps"], 3), round(c["ranking"][-1]["served_mw_steps"], 3)) for c in rest})
    return 0 if all(r["pass_invariants"] for r in rows) else 1

if __name__ == "__main__":
    sys.exit(main())
