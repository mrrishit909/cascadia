"""Regenerate scenarios/ + precomputed/ + manifest. One command: uv run python -m research.export.export_fixtures"""
import hashlib, json, pathlib
from research.models.oracle import solve, VOLL, N_SEG

ROOT = pathlib.Path(__file__).resolve().parents[2]
D = ROOT / "public/data"
sha = lambda b: hashlib.sha256(b).hexdigest()
SCENARIOS = {
    "baseline": dict(desc="Unmodified IEEE case30.", params={}),
    "islanding": dict(desc="Remove substation idx 26 (IEEE bus 27): buses idx 28-29 form a generation-less island; its 13 MW load is shed 100% without a solve.",
                      params={"removed_buses": [26]}),
    "infeasible": dict(desc="Line idx 9 capacity x0.25 with shedding disabled (allow_shed=false): the thermal limit makes the island LP genuinely infeasible; the diagnostic is exposed instead of a clamped number.",
                       params={"line_capacity_factor": {"9": 0.25}, "allow_shed": False}),
}


def main():
    case_bytes = (D / "raw-metadata/case30.json").read_bytes()
    case = json.loads(case_bytes)
    oracle_sha = sha((ROOT / "research/models/oracle.py").read_bytes())
    for sub in ("scenarios", "precomputed"): (D / sub).mkdir(exist_ok=True)
    for sid, s in SCENARIOS.items():
        sc = dict(id=sid, description=s["desc"], params=s["params"], case="raw-metadata/case30.json", case_sha256=sha(case_bytes),
                  data_labels=dict(topology_and_ratings="REAL_IEEE_BENCHMARK", voll="SYNTHETIC_ASSUMPTION", scenario="HYPOTHETICAL_COUNTERFACTUAL"),
                  seed=None, deterministic=True, voll_eur_per_mwh=VOLL, cost_segments=N_SEG)
        res = solve(case, json.loads(json.dumps(s["params"])))
        pc = dict(id=sid, label="SIMULATED: island-aware DC-OPF oracle output (not observed data)", scenario_ref=f"scenarios/{sid}.json",
                  oracle="research/models/oracle.py", oracle_sha256=oracle_sha, generator="research/export/export_fixtures.py",
                  seed=None, deterministic=True, limitations=["DC approximation, lossless, no voltage/reactive limits",
                  "quadratic generator costs piecewise-linearised (4 segments)", "VOLL=1000 EUR/MWh assumed", "single-shot response, no cascading trips"],
                  result=res)
        (D / f"scenarios/{sid}.json").write_text(json.dumps(sc, indent=1, sort_keys=True))
        (D / f"precomputed/{sid}.json").write_text(json.dumps(pc, indent=1, sort_keys=True))
    files = sorted(p for sub in ("raw-metadata", "scenarios", "precomputed") for p in (D / sub).glob("*.json"))
    man = dict(version=1, oracle_sha256=oracle_sha, files={str(p.relative_to(D)): sha(p.read_bytes()) for p in files})
    (D / "provenance/manifest.json").write_text(json.dumps(man, indent=1))
    print(json.dumps(man, indent=1))

if __name__ == "__main__":
    main()
