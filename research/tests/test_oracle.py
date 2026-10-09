import copy, json, pathlib
import pytest
from research.models.oracle import solve, TOL

ROOT = pathlib.Path(__file__).resolve().parents[2]
CASE = json.load(open(ROOT / "public/data/raw-metadata/case30.json"))
BASE = solve(CASE)


def test_normal_baseline():
    assert BASE["status"] == "optimal" and BASE["total_unserved_mw"] == 0
    assert abs(sum(BASE["gen"].values()) - 189.2) < TOL and abs(BASE["islands"][0]["balance_mw"]) < TOL
    assert abs(BASE["total_load_mw"] - 189.2) < TOL


def test_island_balance_all_removals():  # unit:island_balance
    for b in range(30):
        r = solve(CASE, {"removed_buses": [b]})
        for i in r["islands"]:
            if i["has_generation"]: assert abs(i["balance_mw"]) < TOL
            else: assert i["shed_mw"] == i["load_mw"]  # 100% shed, no silent import
        assert abs(sum(r["gen"].values()) - sum(i["served_mw"] for i in r["islands"])) < TOL


def test_islanding_no_generation_sheds_all_and_reports_separately():
    r = solve(CASE, {"removed_buses": [26]})
    assert r["shed_no_generation_mw"] == pytest.approx(13.0) and r["unserved_removed_mw"] == 0
    r = solve(CASE, {"removed_buses": [11]})  # bus with 11.2 MW load: removed-substation load is its own bucket
    assert r["unserved_removed_mw"] == pytest.approx(11.2) and r["shed_economic_mw"] == 0


def test_boundary_line_exactly_at_limit():  # unit:boundary_cases
    l = max(BASE["flows"], key=lambda k: abs(BASE["flows"][k]) / BASE["line_rating_mw"][k])
    f = abs(BASE["flows"][l]) / BASE["line_rating_mw"][l]
    r = solve(CASE, {"line_capacity_factor": {l: f * (1 + 1e-9)}})
    assert f < 1 and r["total_unserved_mw"] < 1e-6 and l in r["binding_lines"]  # at limit: still served, flagged binding
    r = solve(CASE, {"line_capacity_factor": {9: 0.5}})
    assert r["shed_economic_mw"] > 1 and 9 in r["binding_lines"]


def test_infeasible_diagnostic():  # unit:infeasible_cases
    r = solve(CASE, {"line_capacity_factor": {9: 0.25}, "allow_shed": False})
    assert r["status"] == "infeasible" and r["diagnostics"]
    r = solve(CASE, {"removed_buses": [26], "allow_shed": False})
    assert r["status"] == "infeasible" and "no generation" in r["diagnostics"][0]


def test_zero_and_empty():
    r = solve(CASE, {"gen_pmax_mw": {str(g["idx"]): 0 for g in CASE["gens"]}})
    assert r["shed_economic_mw"] == pytest.approx(189.2) and r["gen"][0] == 0  # all generation gone: full shed
    empty = copy.deepcopy(CASE); empty["loads"] = []
    r = solve(empty); assert r["objective"] == pytest.approx(0) and r["total_unserved_mw"] == 0
    r = solve(CASE, {"removed_buses": list(range(30))})
    assert r["islands"] == [] and r["unserved_removed_mw"] == pytest.approx(189.2)


@pytest.mark.parametrize("sc", [{"removed_buses": [99]}, {"removed_buses": [-1]}, {"line_capacity_factor": {0: -1}},
                                {"line_capacity_factor": {99: 1}}, {"line_capacity_factor": {0: float("nan")}},
                                {"gen_pmax_mw": {0: -5}}, {"load_scale": {0: -1}}])
def test_invalid_parameters(sc):
    with pytest.raises(ValueError): solve(CASE, sc)


def test_n1_sweep_file():  # unit:n1_parity_sweep
    d = json.load(open(ROOT / "verification/REFERENCE_RESULTS/n1_sweep.json"))["cases"]
    assert len(d) == 195 and all(c["pass_invariants"] for c in d)


def test_pandapower_crosscheck_file():
    x = json.load(open(ROOT / "verification/REFERENCE_RESULTS/pandapower_crosscheck.json"))
    ok = [e for e in x["rundcpp_flow_check"] if "error" not in e]
    assert len(ok) == 187 and max(e["max_flow_diff_mw"] for e in ok) < 1e-6
    assert all(abs(e["oracle_dispatch_quadratic_cost"] / e["pp_quadratic_cost"] - 1) < 0.01 for e in x["rundcopp_cost_check"])
