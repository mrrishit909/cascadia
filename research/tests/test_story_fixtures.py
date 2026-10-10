"""Parity tests for the 3 chapter "story" fixtures (public/data/precomputed/intro_fault_line33.json,
ch4_fault_bus26.json, ch5_restoration_island_pocket_plus_line9.json), mirroring test_oracle.py's/
test_add_line_restoration.py's existing pattern for baseline/infeasible/islanding and the n1_sweep/
add_line_restoration reference files.
"""
import json
import pathlib

import pytest

from research.models.oracle import TOL, solve

ROOT = pathlib.Path(__file__).resolve().parents[2]
CASE = json.load(open(ROOT / "public/data/raw-metadata/case30.json"))
D = ROOT / "public/data/precomputed"


def _load(name):
    return json.load(open(D / f"{name}.json"))


def test_intro_fault_line33_matches_fresh_oracle_run():
    fx = _load("intro_fault_line33")
    r = solve(CASE, fx["meta"]["params"])
    assert r["status"] == fx["result"]["status"] == "optimal"
    assert abs(r["objective"] - fx["result"]["objective"]) < TOL
    assert abs(r["shed_no_generation_mw"] - fx["result"]["shed_no_generation_mw"]) < TOL


def test_intro_fault_line33_matches_n1_sweep_reference():
    sweep = json.load(open(ROOT / "verification/REFERENCE_RESULTS/n1_sweep.json"))["cases"]
    ref = next(c for c in sweep if c["case_id"] == "line_outage_33")
    fx = _load("intro_fault_line33")
    assert abs(ref["objective"] - fx["result"]["objective"]) < TOL
    assert abs(ref["total_shed"] - fx["result"]["total_unserved_mw"]) < TOL
    assert ref["n_islands"] == len(fx["result"]["islands"])


def test_ch4_fault_bus26_matches_fresh_oracle_run():
    fx = _load("ch4_fault_bus26")
    r = solve(CASE, fx["meta"]["params"])
    assert r["status"] == fx["result"]["status"] == "optimal"
    assert abs(r["objective"] - fx["result"]["objective"]) < TOL
    assert abs(r["shed_no_generation_mw"] - fx["result"]["shed_no_generation_mw"]) < TOL


def test_ch4_fault_bus26_matches_n1_sweep_reference():
    sweep = json.load(open(ROOT / "verification/REFERENCE_RESULTS/n1_sweep.json"))["cases"]
    ref = next(c for c in sweep if c["case_id"] == "bus_removal_26")
    fx = _load("ch4_fault_bus26")
    assert abs(ref["objective"] - fx["result"]["objective"]) < TOL
    assert abs(ref["total_shed"] - fx["result"]["total_unserved_mw"]) < TOL
    assert ref["n_islands"] == len(fx["result"]["islands"])


def test_ch5_restoration_top3_matches_reference_file():
    fx = _load("ch5_restoration_island_pocket_plus_line9")
    ref = json.load(open(ROOT / "verification/REFERENCE_RESULTS/add_line_restoration.json"))
    case = next(c for c in ref["restoration_cases"] if c["case_id"] == "island_pocket_plus_line9")
    assert fx["down"] == case["down"]
    assert fx["n_orders_total"] == case["n_orders"] == 6
    assert len(fx["ranking"]) == 3
    assert fx["ranking"] == case["ranking"][:3]  # exact trim, no regeneration
    # all top-3 are rank 1 (4-way tie in the source file; see DATA_CONTRACT.yaml CAS-INT-006 row)
    assert all(r["rank"] == 1 for r in fx["ranking"])
    assert all(r["served_mw_steps"] == pytest.approx(554.5999999999999) for r in fx["ranking"])


def test_ch5_restoration_shape_matches_RestoreSeq():  # unit:ch5_shape
    fx = _load("ch5_restoration_island_pocket_plus_line9")
    for r in fx["ranking"]:
        assert set(r) >= {"order", "steps", "served_mw_steps", "final_served_mw", "rank"}
        for s in r["steps"]:
            assert set(s) >= {"step", "restored", "served_mw", "unserved_mw", "status"}
