"""N-1 sweep + pandapower cross-check. Writes verification/REFERENCE_RESULTS/{n1_sweep,pandapower_crosscheck}.json."""
import copy, hashlib, json, pathlib, sys, warnings
import numpy as np
import pandapower as pp, pandapower.networks as pn
from research.models.oracle import solve, TOL, VOLL, N_SEG

ROOT = pathlib.Path(__file__).resolve().parents[2]
CASE = json.load(open(ROOT / "public/data/raw-metadata/case30.json"))
CAP_FACTORS = [0.5, 0.25, 1.5]  # per-line capacity changes tested (halve, quarter, +50%)


def cases():
    yield "baseline", {}
    for b in range(30): yield f"bus_removal_{b}", {"removed_buses": [b]}
    for l in range(41):
        for f in CAP_FACTORS: yield f"line_cap_{l}_x{f}", {"line_capacity_factor": {l: f}}
    for l in range(41): yield f"line_outage_{l}", {"disabled_lines": [l]}


def invariants(r):
    """Return list of violated invariants (empty = pass)."""
    bad = []
    if r["status"] != "optimal": return ["status:" + r["status"]]
    for i in r["islands"]:
        if abs(i["balance_mw"]) > TOL: bad.append(f"island balance {i['balance_mw']}")
    isl = r["islands"]
    if abs(r["total_load_mw"] - r["unserved_removed_mw"] - sum(i["served_mw"] + i["shed_mw"] for i in isl)) > TOL:
        bad.append("load accounting (load = removed + served + shed per island)")
    if abs(sum(r["gen"].values()) - sum(i["served_mw"] for i in isl)) > TOL: bad.append("gen != served")
    for li, f in r["flows"].items():
        if abs(f) > r["line_rating_mw"][li] + 1e-6: bad.append(f"line {li} over limit")
    for g in CASE["gens"]:
        if r["gen"][g["idx"]] > g["pmax_mw"] + 1e-6: bad.append(f"gen {g['idx']} over pmax")
    return bad


def pp_check(sc, r):
    """Compare oracle dispatch/shed against pandapower rundcpp flows on the same topology."""
    net = pn.case30()
    for b in sc.get("removed_buses", []): net.bus.at[b, "in_service"] = False
    for l in sc.get("disabled_lines", []): net.line.at[l, "in_service"] = False
    for b in sc.get("removed_buses", []):
        net.line.loc[(net.line.from_bus == b) | (net.line.to_bus == b), "in_service"] = False
        net.gen.loc[net.gen.bus == b, "in_service"] = False
        net.load.loc[net.load.bus == b, "in_service"] = False
    for k, g in net.gen.iterrows(): net.gen.at[k, "p_mw"] = r["gen"][k + 1]
    net.load["p_mw"] = [max(0.0, p - r["shed"].get(b, 0.0)) for b, p in zip(net.load.bus, net.load.p_mw)]
    pp.rundcpp(net)
    d = max((abs(net.res_line.p_from_mw[l] - f) for l, f in r["flows"].items()), default=0.0)
    return dict(max_flow_diff_mw=float(d), slack_diff_mw=float(abs(net.res_ext_grid.p_mw[0] - r["gen"][0])))


def pp_opf(sc, r):
    """Independent quadratic DC-OPF (pandapower rundcopp, PIPS) for shed-free single-island cases; baseline limits only."""
    net = pn.case30()
    f = sc.get("line_capacity_factor", {})
    for l in sc.get("disabled_lines", []): net.line.at[l, "in_service"] = False
    for l, k in f.items(): net.line.at[l, "max_loading_percent"] = 100 * k
    for b in sc.get("removed_buses", []): net.bus.at[b, "in_service"] = False
    for b in sc.get("removed_buses", []):
        net.line.loc[(net.line.from_bus == b) | (net.line.to_bus == b), "in_service"] = False
        net.gen.loc[net.gen.bus == b, "in_service"] = False
        net.load.loc[net.load.bus == b, "in_service"] = False
    pp.rundcopp(net)
    quad = lambda p, c: c.cp1_eur_per_mw * p + c.cp2_eur_per_mw2 * p * p
    pc = net.poly_cost
    pp_cost = net.res_cost
    mine = sum(quad(r["gen"][i], pc.loc[(pc.et == ("ext_grid" if i == 0 else "gen")) & (pc.element == (0 if i == 0 else i - 1))].iloc[0]) for i in r["gen"])
    return dict(pp_quadratic_cost=float(pp_cost), oracle_dispatch_quadratic_cost=float(mine), oracle_pwl_objective=r["objective"])


def main():
    rows, xc, opf = [], [], []
    for cid, sc in cases():
        r = solve(CASE, sc)
        bad = invariants(r)
        rows.append(dict(case_id=cid, scenario=sc, status=r["status"], objective=r["objective"],
                         total_shed=r["total_unserved_mw"], shed_economic=r["shed_economic_mw"],
                         shed_no_generation=r["shed_no_generation_mw"], unserved_removed=r["unserved_removed_mw"],
                         n_islands=len(r["islands"]), per_island_balance=[i["balance_mw"] for i in r["islands"]],
                         binding_lines=r["binding_lines"], pass_invariants=not bad, violations=bad))
        feas = r["status"] == "optimal" and len(r["islands"]) == 1
        if feas:
            try:
                c = pp_check(sc, r); xc.append(dict(case_id=cid, **c))
            except Exception as e:
                xc.append(dict(case_id=cid, error=repr(e)[:200]))
            if r["total_unserved_mw"] - r["unserved_removed_mw"] < TOL and not sc.get("removed_buses"):
                try: opf.append(dict(case_id=cid, **pp_opf(sc, r)))
                except Exception as e: opf.append(dict(case_id=cid, error=repr(e)[:200]))
    meta = dict(generator="research/evaluate/n1_sweep.py", deterministic=True, seed=None, voll=VOLL, cost_segments=N_SEG,
                label="SIMULATED (oracle output on REAL_IEEE case30 topology; VOLL synthetic)", cap_factors=CAP_FACTORS, tolerance_mw=TOL)
    out = ROOT / "verification/REFERENCE_RESULTS"
    out.mkdir(parents=True, exist_ok=True)
    (out / "n1_sweep.json").write_text(json.dumps(dict(meta=meta, cases=rows), indent=1))
    ok = [x for x in xc if "error" not in x]
    (out / "pandapower_crosscheck.json").write_text(json.dumps(dict(meta=meta, rundcpp_flow_check=xc, rundcopp_cost_check=opf), indent=1))
    npass = sum(r["pass_invariants"] for r in rows)
    print("cases", len(rows), "pass_invariants", npass, "fail", len(rows) - npass)
    print("status counts", {s: sum(r["status"] == s for r in rows) for s in {r["status"] for r in rows}})
    print("with shed", sum(r["total_shed"] > TOL for r in rows), "islanded(n_islands>1)", sum(r["n_islands"] > 1 for r in rows))
    print("rundcpp: checked", len(xc), "errors", len(xc) - len(ok), "max flow diff", max((x["max_flow_diff_mw"] for x in ok), default=None),
          "max slack diff", max((x["slack_diff_mw"] for x in ok), default=None))
    print("rundcopp: attempted", len(opf), "errors", sum("error" in x for x in opf))
    return 0 if npass == len(rows) else 1

if __name__ == "__main__":
    warnings.filterwarnings("ignore"); sys.exit(main())
