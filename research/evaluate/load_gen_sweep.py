"""load_scale (CAS-INT-002) / gen_pmax_mw (CAS-INT-003) sweep, mirroring n1_sweep.py's structure.
Unlike the all-or-nothing shed probe used during manual M4 QA (zeroing every generator sheds
exactly total system load, which a dispatch-free engine would also print), these cases are chosen
to force partial shed (0 < shed < total_load) and binding lines, so parity actually exercises the
LP's dispatch logic. Writes verification/REFERENCE_RESULTS/load_gen_sweep.json.
"""
import json, pathlib, sys, warnings
from research.models.oracle import solve, TOL, VOLL, N_SEG

ROOT = pathlib.Path(__file__).resolve().parents[2]
CASE = json.load(open(ROOT / "public/data/raw-metadata/case30.json"))
GEN_IDX = [g["idx"] for g in CASE["gens"]]
GEN_PMAX = {g["idx"]: g["pmax_mw"] for g in CASE["gens"]}
LOAD_BUSES = sorted({l["bus"] for l in CASE["loads"]})[:8]
LOAD_FACTORS = [2.0, 4.0, 8.0]


def cases():
    for g in GEN_IDX:
        yield f"gen_pmax_{g}_zero", {"gen_pmax_mw": {g: 0.0}}
        yield f"gen_pmax_{g}_half", {"gen_pmax_mw": {g: GEN_PMAX[g] / 2}}
    for b in LOAD_BUSES:
        for f in LOAD_FACTORS:
            yield f"load_scale_{b}_x{f}", {"load_scale": {b: f}}
    # combined cases engineered to force partial (not total) shed: removing ~210 MW of the 335 MW
    # fleet's capacity (gens 0,1,2 to zero) leaves 125 MW against 189.2 MW load
    yield "combo_gens012_zero", {"gen_pmax_mw": {0: 0.0, 1: 0.0, 2: 0.0}}
    yield "combo_gens01_zero_load_x2", {"gen_pmax_mw": {0: 0.0, 1: 0.0}, "load_scale": {LOAD_BUSES[0]: 2.0}}
    yield "combo_gen0_half_load_x4", {"gen_pmax_mw": {0: GEN_PMAX[0] / 2}, "load_scale": {LOAD_BUSES[1]: 4.0}}


def invariants(r):
    bad = []
    if r["status"] != "optimal":
        return ["status:" + r["status"]]
    for i in r["islands"]:
        if abs(i["balance_mw"]) > TOL:
            bad.append(f"island balance {i['balance_mw']}")
    for li, f in r["flows"].items():
        if abs(f) > r["line_rating_mw"][li] + 1e-6:
            bad.append(f"line {li} over limit")
    return bad


def main():
    rows = []
    for cid, sc in cases():
        r = solve(CASE, sc)
        bad = invariants(r)
        rows.append(dict(case_id=cid, scenario=sc, status=r["status"], objective=r["objective"],
                          total_shed=r["total_unserved_mw"], shed_economic=r["shed_economic_mw"],
                          n_islands=len(r["islands"]), per_island_balance=[i["balance_mw"] for i in r["islands"]],
                          binding_lines=r["binding_lines"], pass_invariants=not bad, violations=bad))
    meta = dict(generator="research/evaluate/load_gen_sweep.py", deterministic=True, seed=None, voll=VOLL,
                cost_segments=N_SEG, label="SIMULATED (oracle output on REAL_IEEE case30 topology; VOLL synthetic)",
                tolerance_mw=TOL, purpose="partial-shed/binding-line parity coverage for CAS-INT-002/003, "
                "distinct from the all-or-nothing shed probe used during manual M4 QA")
    out = ROOT / "verification/REFERENCE_RESULTS"
    out.mkdir(parents=True, exist_ok=True)
    (out / "load_gen_sweep.json").write_text(json.dumps(dict(meta=meta, cases=rows), indent=1))
    npass = sum(r["pass_invariants"] for r in rows)
    partial = [r for r in rows if 0 < r["total_shed"] < sum(l["p_mw"] for l in CASE["loads"]) - TOL]
    print("cases", len(rows), "pass_invariants", npass, "fail", len(rows) - npass)
    print("partial-shed cases (0 < shed < total_load):", len(partial), [r["case_id"] for r in partial])
    return 0 if npass == len(rows) and len(partial) > 0 else 1


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    sys.exit(main())
