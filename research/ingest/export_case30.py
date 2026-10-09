"""Export pandapower's case30 to public/data/raw-metadata/case30.json (real IEEE values, unmodified)."""
import datetime, hashlib, json, math, pathlib
import pandapower, pandapower.networks as pn

OUT = pathlib.Path(__file__).resolve().parents[2] / "public/data/raw-metadata/case30.json"
canon = lambda o: json.dumps(o, sort_keys=True, separators=(",", ":")).encode()


def build():
    net = pn.case30()
    buses = [dict(idx=int(i), name=str(r["name"]), vn_kv=float(r.vn_kv), zone=float(r.zone),
                  x=json.loads(r.geo)["coordinates"][0], y=json.loads(r.geo)["coordinates"][1])
             for i, r in net.bus.iterrows()]
    vn = {b["idx"]: b["vn_kv"] for b in buses}
    lines = []
    for i, r in net.line.iterrows():
        f = int(r.from_bus)
        x_ohm = float(r.x_ohm_per_km * r.length_km)
        lines.append(dict(idx=int(i), from_bus=f, to_bus=int(r.to_bus), r_ohm=float(r.r_ohm_per_km * r.length_km),
                          x_ohm=x_ohm, max_i_ka=float(r.max_i_ka),
                          x_pu=x_ohm / (vn[f] ** 2 / net.sn_mva),
                          rating_mw=math.sqrt(3) * vn[f] * float(r.max_i_ka)))  # sqrt3*kV*kA
    gens = []
    cost = net.poly_cost
    for i, r in net.gen.iterrows():
        c = cost[(cost.et == "gen") & (cost.element == i)].iloc[0]
        gens.append(dict(idx=len(gens), bus=int(r.bus), pmin_mw=float(r.min_p_mw), pmax_mw=float(r.max_p_mw),
                         c0=float(c.cp0_eur), c1=float(c.cp1_eur_per_mw), c2=float(c.cp2_eur_per_mw2), source="gen"))
    e = net.ext_grid.iloc[0]
    c = cost[cost.et == "ext_grid"].iloc[0]
    # ext_grid is a PV slack in pandapower; the oracle treats it as an ordinary generator (no global slack).
    gens.insert(0, dict(idx=0, bus=int(e.bus), pmin_mw=float(e.min_p_mw), pmax_mw=float(e.max_p_mw),
                        c0=float(c.cp0_eur), c1=float(c.cp1_eur_per_mw), c2=float(c.cp2_eur_per_mw2), source="ext_grid"))
    for k, g in enumerate(gens): g["idx"] = k
    loads = [dict(bus=int(r.bus), p_mw=float(r.p_mw)) for _, r in net.load.iterrows()]
    return dict(sn_mva=float(net.sn_mva), buses=buses, lines=lines, gens=gens, loads=loads)


if __name__ == "__main__":
    data = build()
    doc = dict(
        provenance=dict(
            label="REAL_IEEE_BENCHMARK (values unmodified; unit conversions: x_pu, rating_mw derived)",
            source_chain=["PYPOWER case30 (https://github.com/rwl/PYPOWER)",
                          "Univ. of Washington Power Systems Test Case Archive, '30 Bus Power Flow Test Case' (http://labs.ece.uw.edu/pstca/)",
                          f"pandapower {pandapower.__version__} pandapower.networks.case30() (https://github.com/e2nIEE/pandapower)"],
            license="pandapower: BSD-3-Clause (University of Kassel / Fraunhofer IEE). Underlying IEEE/UW test-case data: long-standing open academic benchmark; no separate license text located (TODO: confirm if redistribution terms become a gate concern).",
            date_accessed=datetime.date.today().isoformat(),
            generator="research/ingest/export_case30.py", seed=None, deterministic=True,
            units=dict(power="MW", voltage="kV", current="kA", impedance_ohm="ohm", x_pu="p.u. on sn_mva & from-bus vn_kv", cost="EUR/MWh (pandapower label; benchmark values)"),
            notes=["rating_mw = sqrt(3)*vn_kv*max_i_ka (thermal, from real max_i_ka)",
                   "ext_grid at bus idx 0 is exported as generator idx 0 (source=ext_grid)",
                   "bus.name is the 1-based IEEE bus number; idx is 0-based and used everywhere else",
                   "bus x,y are pandapower's schematic geodata, not geography"],
            data_sha256=hashlib.sha256(canon(data)).hexdigest()),
        **data)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, indent=1))
    print("wrote", OUT, doc["provenance"]["data_sha256"])
