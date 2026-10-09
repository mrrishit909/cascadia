import json, pathlib
import pytest
from research.models.oracle import solve, load_candidates, rank_restoration, restoration_sequence, restoration_orders, TOL

ROOT = pathlib.Path(__file__).resolve().parents[2]
CASE = json.load(open(ROOT / "public/data/raw-metadata/case30.json"))
CANDS = load_candidates()
BASE = solve(CASE)


def balanced(r):
    for i in r["islands"]:
        if i["has_generation"]: assert abs(i["balance_mw"]) < TOL
    assert abs(sum(r["gen"].values()) - sum(i["served_mw"] for i in r["islands"])) < TOL


def test_candidates_synthetic_and_unconnected():
    assert json.load(open(ROOT / "public/data/raw-metadata/candidate_lines.json"))["provenance"]["label"] == "SYNTHETIC_ASSUMPTION"
    existing = {frozenset((l["from_bus"], l["to_bus"])) for l in CASE["lines"]}
    assert [c["idx"] for c in CANDS] == list(range(41, 41 + len(CANDS)))
    assert all(frozenset((c["from_bus"], c["to_bus"])) not in existing for c in CANDS)


def test_add_line_changes_routing_healthy():
    for k, c in enumerate(CANDS):
        r = solve(CASE, {"added_lines": [k]}); balanced(r)
        assert r["status"] == "optimal" and r["total_unserved_mw"] == 0
        assert c["idx"] in r["flows"] and c["idx"] in r["line_rating_mw"]
        assert abs(r["flows"][c["idx"]]) <= c["rating_mw"] + 1e-6
        assert max(abs(r["flows"][i] - BASE["flows"][i]) for i in BASE["flows"]) > 1e-3  # routing actually moved
        others = [x["idx"] for j, x in enumerate(CANDS) if j != k]
        assert not set(others) & set(r["flows"])  # unadded candidates stay absent
    assert not set(range(41, 46)) & set(BASE["flows"])  # no added_lines -> original topology untouched


def test_add_line_relieves_congestion():
    cong = solve(CASE, {"line_capacity_factor": {9: 0.5}})
    best = min(solve(CASE, {"line_capacity_factor": {9: 0.5}, "added_lines": [k]})["objective"] for k in range(len(CANDS)))
    assert best <= cong["objective"] + 1e-9  # adding capacity never hurts (LP relaxation)


def test_add_line_merges_islands():
    cut = solve(CASE, {"removed_buses": [26]})
    assert cut["shed_no_generation_mw"] == pytest.approx(13.0) and len(cut["islands"]) == 2
    r = solve(CASE, {"removed_buses": [26], "added_lines": [0]}); balanced(r)  # candidate 0 = 27-28
    assert len(r["islands"]) == 1 and r["shed_no_generation_mw"] == 0 and r["total_unserved_mw"] == 0
    assert r["unserved_removed_mw"] == 0 and r["flows"][41] != 0
    # added line touching a removed bus is dropped, island stays dark (no silent import)
    r = solve(CASE, {"removed_buses": [27], "added_lines": [0]})
    assert 41 not in r["flows"]


def test_add_line_no_silent_import_when_not_merging():
    r = solve(CASE, {"removed_buses": [26], "added_lines": [1]})  # 9-14 does not reach {28,29}
    assert r["shed_no_generation_mw"] == pytest.approx(13.0)


@pytest.mark.parametrize("bad", [[5], [-1], ["a"]])
def test_add_line_invalid(bad):
    with pytest.raises(ValueError): solve(CASE, {"added_lines": bad})


DOWN = [dict(kind="line", id=36), dict(kind="line", id=37), dict(kind="line", id=9)]  # 36+37 isolate the 13 MW {28,29} pocket; 9 is a 32 MW tie


def test_restoration_ranking_known_outcome():
    seq = restoration_sequence(CASE, DOWN, [0, 1, 2])
    assert [s["served_mw"] for s in seq["steps"]] == pytest.approx([176.2, 189.2, 189.2, 189.2])
    rk = rank_restoration(CASE, DOWN)
    assert len(rk) == 6 and rk[0]["rank"] == 1
    # restoring line 9 first wastes a step on a line whose loss only costs nothing extra: orders starting with 2 rank last
    assert all(r["order"][0] == 2 for r in rk[-2:]) and rk[-1]["rank"] == 5
    assert rk[0]["served_mw_steps"] - rk[-1]["served_mw_steps"] == pytest.approx(13.0)
    assert [r["rank"] for r in rk[:4]] == [1, 1, 1, 1] and rk[0]["order"] == [0, 1, 2]  # exact ties -> lexicographic
    for r in rk: assert r["final_served_mw"] == pytest.approx(189.2)  # all orders end fully restored


def test_restoration_bus_elements_and_limits():
    rk = rank_restoration(CASE, [dict(kind="bus", id=11), dict(kind="bus", id=26)])
    assert len(rk) == 2 and rk[0]["served_mw_steps"] > rk[1]["served_mw_steps"]
    with pytest.raises(ValueError): restoration_orders(6)
    with pytest.raises(ValueError): restoration_sequence(CASE, DOWN, [0, 0, 1])
    assert len(restoration_orders(5)) == 120
    # subset of candidate orders
    sub = rank_restoration(CASE, DOWN, orders=[[2, 1, 0], [0, 1, 2]])
    assert [r["order"] for r in sub] == [[0, 1, 2], [2, 1, 0]]


def test_reference_file():
    d = json.load(open(ROOT / "verification/REFERENCE_RESULTS/add_line_restoration.json"))
    assert len(d["add_line_cases"]) == 24 and all(c["pass_invariants"] for c in d["add_line_cases"])
    assert [c["n_orders"] for c in d["restoration_cases"]] == [6, 6, 2, 120]
