"""Island-aware DC-OPF oracle (scipy.optimize.linprog / HiGHS). No global slack bus: every island balances itself.

Scenario (all optional):
  removed_buses: [idx]            substation removed; its load is 'unserved_removed', its gens and lines are gone
  line_capacity_factor: {idx: f}  scales rating_mw (f>=0; f==0 is an outage)
  disabled_lines: [idx]           line outage
  gen_pmax_mw: {idx: MW}          override generator Pmax
  load_scale: {bus: f}            scale load at a bus
  added_lines: [k]                SYNTHETIC candidate lines (public/data/raw-metadata/candidate_lines.json, idx 41+k) added to topology
  allow_shed: bool (True)         False -> shed forced to 0, so an unservable island is reported 'infeasible'
Model assumptions: VOLL = 1000 EUR/MWh (ASSUMED, not in IEEE data); generator quadratics piecewise-linearised
into N_SEG equal-width secant segments (convex, so merit-order filling is automatic); lossless DC; no Q/voltage.
"""
import json
import pathlib
from functools import cmp_to_key
from itertools import permutations

import networkx as nx
import numpy as np
from scipy.optimize import linprog

VOLL = 1000.0
N_SEG = 4
TOL = 1e-6
MAX_RESTORE = 5  # k<=5 down elements -> <=120 orders, all enumerated
CAND_PATH = pathlib.Path(__file__).resolve().parents[2] / "public/data/raw-metadata/candidate_lines.json"


def load_candidates():
    return json.load(open(CAND_PATH))["lines"]


def _validate(case, sc, cands=()):
    nb, nl, ng = len(case["buses"]), len(case["lines"]), len(case["gens"])
    for b in sc.get("removed_buses", []):
        if not (isinstance(b, int) and 0 <= b < nb): raise ValueError(f"invalid bus {b}")
    for k, f in sc.get("line_capacity_factor", {}).items():
        if not 0 <= int(k) < nl: raise ValueError(f"invalid line {k}")
        if not (np.isfinite(f) and f >= 0): raise ValueError(f"invalid capacity factor {f} for line {k}")
    for k in sc.get("disabled_lines", []):
        if not 0 <= int(k) < nl: raise ValueError(f"invalid line {k}")
    for k, v in sc.get("gen_pmax_mw", {}).items():
        if not 0 <= int(k) < ng: raise ValueError(f"invalid generator {k}")
        if not (np.isfinite(v) and v >= 0): raise ValueError(f"invalid Pmax {v}")
    for k, f in sc.get("load_scale", {}).items():
        if not 0 <= int(k) < nb: raise ValueError(f"invalid bus {k}")
        if not (np.isfinite(f) and f >= 0): raise ValueError(f"invalid load scale {f}")
    for k in sc.get("added_lines", []):
        if not (isinstance(k, int) and 0 <= k < len(cands)): raise ValueError(f"invalid candidate line {k}")
    for l in list(case["lines"]) + list(cands):
        if not l["x_pu"] > 0: raise ValueError("non-positive reactance")


def _solve_island(case, buses, lines, gens, load, pmax, rating, allow_shed):
    """buses: list of idx; lines: list of line idx; gens: gen idx; returns dict."""
    bpos = {b: i for i, b in enumerate(buses)}
    nB = len(buses)
    # PTDF (MW/MW) for this island, reference = first bus
    if lines:
        A = np.zeros((len(lines), nB)); inv_x = np.zeros(len(lines))
        for k, li in enumerate(lines):
            l = case["lines"][li]
            A[k, bpos[l["from_bus"]]] = 1; A[k, bpos[l["to_bus"]]] = -1; inv_x[k] = 1 / l["x_pu"]
        Bbus = A.T @ (inv_x[:, None] * A)
        ptdf = np.zeros((len(lines), nB))
        ptdf[:, 1:] = (inv_x[:, None] * A)[:, 1:] @ np.linalg.inv(Bbus[1:, 1:])  # flow = ptdf @ injection (pu-scaled cancels)
    else:
        ptdf = np.zeros((0, nB))
    # variables: [segments of each gen..., shed per load-bus]
    segs, cost, cols_bus, const = [], [], [], 0.0
    for g in gens:
        G = case["gens"][g]; lo, hi = G["pmin_mw"], pmax[g]
        if hi < lo: lo = hi  # Pmax override below Pmin: Pmin relaxed (documented)
        const += G["c0"] + G["c1"] * lo + G["c2"] * lo * lo
        w = (hi - lo) / N_SEG
        for s in range(N_SEG):
            a, b = lo + s * w, lo + (s + 1) * w
            segs.append((g, w, lo)); cost.append(G["c1"] + G["c2"] * (a + b)); cols_bus.append(bpos[G["bus"]])
    nG = len(segs)
    lbuses = [b for b in buses if load.get(b, 0) > 0]
    nvar = nG + len(lbuses)
    c = np.array(cost + [VOLL] * len(lbuses))
    ub = [s[1] for s in segs] + [load[b] if allow_shed else 0.0 for b in lbuses]
    # injection = M @ x - d   (gen at bus + shed at bus - load)
    M = np.zeros((nB, nvar))
    for j, bi in enumerate(cols_bus): M[bi, j] = 1
    for j, b in enumerate(lbuses): M[bpos[b], nG + j] = 1
    d = np.array([load.get(b, 0.0) for b in buses])
    # balance: sum(M x) = sum(d) - pmin_total  (gens sit at lo then add segments)
    lo_inj = np.zeros(nB)
    for g in gens:
        lo_inj[bpos[case["gens"][g]["bus"]]] += min(case["gens"][g]["pmin_mw"], pmax[g])
    Aeq = M.sum(axis=0, keepdims=True); beq = [d.sum() - lo_inj.sum()]
    if lines:
        F = ptdf @ M; f0 = ptdf @ (lo_inj - d); cap = np.array([rating[li] for li in lines])
        Aub = np.vstack([F, -F]); bub = np.concatenate([cap - f0, cap + f0])
    else:
        Aub = bub = None
    r = linprog(c, A_ub=Aub, b_ub=bub, A_eq=Aeq, b_eq=beq, bounds=[(0, u) for u in ub], method="highs")
    if r.status != 0:
        return dict(status="infeasible", message=r.message)
    x = r.x
    gen = {g: min(case["gens"][g]["pmin_mw"], pmax[g]) for g in gens}
    for j, (g, _, _) in enumerate(segs): gen[g] += x[j]
    shed = {b: float(x[nG + j]) for j, b in enumerate(lbuses)}
    inj = lo_inj - d + M @ x
    flows = ptdf @ inj if lines else np.zeros(0)
    return dict(status="optimal", objective=float(r.fun + const), gen_cost=float(r.fun + const - VOLL * sum(shed.values())),
                gen={g: float(v) for g, v in gen.items()}, shed=shed, flows={li: float(f) for li, f in zip(lines, flows)},
                balance=float(sum(gen.values()) - (d.sum() - sum(shed.values()))))


def solve(case, sc=None, candidates=None):
    sc = sc or {}
    if sc.get("added_lines") and candidates is None: candidates = load_candidates()
    candidates = candidates or []
    _validate(case, sc, candidates)
    added = set(sc.get("added_lines", []))
    n0 = len(case["lines"])
    if added:  # unadded candidates are appended as disabled lines so indices stay list positions
        case = {**case, "lines": list(case["lines"]) + [dict(c, idx=n0 + k) for k, c in enumerate(candidates)]}
    removed = set(sc.get("removed_buses", []))
    allow_shed = sc.get("allow_shed", True)
    cf = {int(k): v for k, v in sc.get("line_capacity_factor", {}).items()}
    off = set(int(k) for k in sc.get("disabled_lines", []))
    if added: off |= {n0 + k for k in range(len(candidates)) if k not in added}
    pmax = {g["idx"]: g["pmax_mw"] for g in case["gens"]}
    pmax.update({int(k): v for k, v in sc.get("gen_pmax_mw", {}).items()})
    ls = {int(k): v for k, v in sc.get("load_scale", {}).items()}
    load = {}
    for l in case["loads"]: load[l["bus"]] = load.get(l["bus"], 0) + l["p_mw"] * ls.get(l["bus"], 1.0)
    rating = {l["idx"]: l["rating_mw"] * cf.get(l["idx"], 1.0) for l in case["lines"]}
    live_lines = [l["idx"] for l in case["lines"] if l["idx"] not in off and not {l["from_bus"], l["to_bus"]} & removed]
    G = nx.Graph(); G.add_nodes_from(b["idx"] for b in case["buses"] if b["idx"] not in removed)
    G.add_edges_from((case["lines"][i]["from_bus"], case["lines"][i]["to_bus"]) for i in live_lines)
    gen_at = {}
    for g in case["gens"]:
        if g["bus"] not in removed: gen_at.setdefault(g["bus"], []).append(g["idx"])

    out = dict(islands=[], gen={}, shed={}, flows={}, diagnostics=[], status="optimal")
    obj = 0.0
    unserved_removed = sum(load.get(b, 0) for b in removed)
    shed_noGen = shed_econ = 0.0
    for comp in sorted((sorted(c) for c in nx.connected_components(G)), key=lambda c: c[0]):
        gs = [g for b in comp for g in gen_at.get(b, [])]
        ls_ = [i for i in live_lines if case["lines"][i]["from_bus"] in comp]
        tot = sum(load.get(b, 0) for b in comp)
        isl = dict(buses=comp, load_mw=tot, has_generation=bool(gs))
        if not gs:
            isl.update(status="no_generation", served_mw=0.0, shed_mw=tot, balance_mw=0.0, kind="shed_no_generation")
            if tot > 0:
                out["diagnostics"].append(f"island {comp} has no generation: {tot:.4g} MW load shed (infeasible to serve)")
                if not allow_shed: out["status"] = "infeasible"
            for b in comp:
                if load.get(b, 0) > 0: out["shed"][b] = load[b]
            shed_noGen += tot; obj += VOLL * tot
        else:
            r = _solve_island(case, comp, ls_, gs, load, pmax, rating, allow_shed)
            if r["status"] != "optimal":
                isl.update(status="infeasible", message=r["message"], shed_mw=None, balance_mw=None)
                out["status"] = "infeasible"
                out["diagnostics"].append(f"island {comp} infeasible with shedding disabled: generation/line limits cannot serve {tot:.4g} MW")
            else:
                s = sum(r["shed"].values())
                isl.update(status="optimal", served_mw=tot - s, shed_mw=s, balance_mw=r["balance"], objective=r["objective"], kind="economic_shed")
                out["gen"].update(r["gen"]); out["flows"].update(r["flows"])
                for b, v in r["shed"].items():
                    if v > TOL: out["shed"][b] = v
                shed_econ += s; obj += r["objective"]
                for li, f in r["flows"].items():
                    if abs(f) >= rating[li] - 1e-6 and rating[li] > 0:
                        out["diagnostics"].append(f"line {li} binding at {rating[li]:.4g} MW")
        out["islands"].append(isl)
    for g in case["gens"]:
        out["gen"].setdefault(g["idx"], 0.0)
    out["binding_lines"] = sorted(li for li, f in out["flows"].items() if rating[li] > 0 and abs(f) >= rating[li] - 1e-6)
    out["line_rating_mw"] = {i: v for i, v in rating.items() if i not in off or i < n0}
    out.update(objective=obj, unserved_removed_mw=unserved_removed, shed_no_generation_mw=shed_noGen,
               shed_economic_mw=shed_econ, total_unserved_mw=unserved_removed + shed_noGen + shed_econ,
               total_load_mw=sum(load.values()),
               model=dict(voll_eur_per_mwh=VOLL, cost_segments=N_SEG, solver="scipy.linprog/highs"))
    return out


# ---- CAS-INT-006: restoration sequencing ---------------------------------------------------------
# Element = {"kind": "bus"|"line", "id": int}. 'down' elements are removed buses / disabled lines on top of base scenario `base`.
# METRIC (design decision): served_mw_steps = sum_{i=0}^{k-1} served(state after i restorations), served = total_load - total_unserved.
# Each restoration action is assumed to take one equal time step (no crew/duration data exists -> labeled assumption), so this is the
# discrete integral of served power over the time spent in each degraded state, in MW*steps (NOT MWh). The final all-restored state
# is identical for every order, so it adds a constant and is excluded from the sum (reported separately). Higher is better; ties
# (within 1e-6) are broken by lexicographic order of the element sequence so rankings are deterministic across languages.
# All k! orders are enumerated (k<=5). Solves are memoised by restored-subset (2^k <= 32 solves).

def _restore_state(base, down, restored):
    sc = dict(base)
    sc["removed_buses"] = sorted(set(base.get("removed_buses", [])) | {e["id"] for i, e in enumerate(down) if e["kind"] == "bus" and i not in restored})
    sc["disabled_lines"] = sorted(set(base.get("disabled_lines", [])) | {e["id"] for i, e in enumerate(down) if e["kind"] == "line" and i not in restored})
    return sc


def restoration_orders(k):
    if not 0 <= k <= MAX_RESTORE: raise ValueError(f"at most {MAX_RESTORE} down elements supported, got {k}")
    return [list(p) for p in permutations(range(k))]


def restoration_sequence(case, down, order, base=None, candidates=None, _cache=None):
    """order: permutation of range(len(down)) (indices into `down`). Returns per-step served MW and the metric."""
    base = base or {}
    k = len(down)
    if sorted(order) != list(range(k)): raise ValueError("order must be a permutation of down-element indices")
    for e in down:
        if e["kind"] not in ("bus", "line"): raise ValueError(f"invalid element kind {e['kind']}")
    cache = {} if _cache is None else _cache
    steps = []
    for i in range(k + 1):
        key = frozenset(order[:i])
        if key not in cache:
            r = solve(case, _restore_state(base, down, key), candidates)
            cache[key] = dict(served_mw=r["total_load_mw"] - r["total_unserved_mw"], unserved_mw=r["total_unserved_mw"], status=r["status"])
        steps.append(dict(step=i, restored=[order[i - 1]] if i else [], **cache[key]))
    return dict(order=list(order), steps=steps, served_mw_steps=sum(s["served_mw"] for s in steps[:k]), final_served_mw=steps[-1]["served_mw"])


def rank_restoration(case, down, orders=None, base=None, candidates=None):
    """Rank candidate orders (default: all k!) best-first by served_mw_steps; adds 'rank' (1-based, ties share rank)."""
    orders = restoration_orders(len(down)) if orders is None else orders
    if len(orders) < 1: raise ValueError("need at least one order")
    cache = {}
    res = [restoration_sequence(case, down, o, base, candidates, cache) for o in orders]
    def cmp(a, b):
        d = b["served_mw_steps"] - a["served_mw_steps"]
        if abs(d) > 1e-6: return -1 if d < 0 else 1
        return -1 if a["order"] < b["order"] else (1 if a["order"] > b["order"] else 0)
    res.sort(key=cmp_to_key(cmp))
    for i, r in enumerate(res):
        r["rank"] = 1 if i == 0 else (res[i - 1]["rank"] if abs(res[i - 1]["served_mw_steps"] - r["served_mw_steps"]) <= 1e-6 else i + 1)
    return res
