// Shapes mirror public/data/raw-metadata/case30.json and public/data/precomputed/*.json
export interface Bus { idx: number; name: string; vn_kv: number; zone: number; x: number; y: number }
export interface Line { idx: number; from_bus: number; to_bus: number; r_ohm: number; x_ohm: number; max_i_ka: number; x_pu: number; rating_mw: number }
export interface Generator { idx: number; bus: number; pmin_mw: number; pmax_mw: number; c0: number; c1: number; c2: number; source: string }
export interface Load { bus: number; p_mw: number }
export interface Case30 { sn_mva: number; buses: Bus[]; lines: Line[]; gens: Generator[]; loads: Load[] }

export interface Scenario { id: string; description: string; case: string; params: Record<string, unknown>; voll_eur_per_mwh: number; data_labels: Record<string, string> }

export interface Island { buses: number[]; status?: string; kind?: string; served_mw?: number; shed_mw?: number | null; balance_mw?: number | null; [k: string]: unknown }
export interface SolveResult {
  status: string
  flows: Record<string, number>          // keyed by line idx, MW
  line_rating_mw: Record<string, number>
  gen: Record<string, number>
  shed: Record<string, number>           // keyed by bus idx
  islands: Island[]
  binding_lines: number[]
  diagnostics: string[]
  total_load_mw: number
  total_unserved_mw: number
  objective: number
}
export interface Precomputed { id: string; label: string; limitations: string[]; result: SolveResult }
