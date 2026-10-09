import type { CandidateLine } from '../engine/dcopf'
import type { Case30, SolveResult } from '../engine/types'

const W = 960, H = 640, PAD = 40
// Layout: pandapower's schematic geodata for case30 (hand-drawn by the case
// authors to be planar-ish), uniformly scaled to fit, y flipped for SVG.
// ponytail: no force relaxation; add if removed-bus/new-line views need it.
function project(network: Case30) {
  const xs = network.buses.map(b => b.x), ys = network.buses.map(b => b.y)
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const k = Math.min((W - 2 * PAD) / (Math.max(...xs) - x0), (H - 2 * PAD) / (Math.max(...ys) - y0))
  return network.buses.map(b => ({ x: PAD + (b.x - x0) * k, y: H - PAD - (b.y - y0) * k }))
}

interface Props { network: Case30; result: SolveResult; removedBus?: number | null; selectedBus?: number | null; onSelect?: (bus: number) => void; selectedLine?: number | null; onSelectLine?: (line: number) => void; alteredLines?: number[]; disabledLines?: number[]; onRestoreLine?: (line: number) => void; candidates?: CandidateLine[]; addedLines?: number[]; onToggleCandidate?: (pos: number) => void }
export function NetworkView({ network, result, removedBus = null, selectedBus = null, onSelect, selectedLine = null, onSelectLine, alteredLines = [], disabledLines = [], onRestoreLine, candidates = [], addedLines = [], onToggleCandidate }: Props) {
  // D2: when infeasible, result.flows/shed/islands are all empty (there is no dispatch), so the old code
  // fell through to "no flow -> grey, not shed -> served", rendering a network that looks fully healthy.
  // Every line/bus gets an explicit infeasible treatment instead -- never derived from an empty flows/shed
  // object standing in for "zero". See verification/NO_FAKE_NUMBERS_AUDIT.md #6 / PROTOTYPE_REPORT.md D2.
  const infeasible = result.status === 'infeasible'
  const noGen = new Set(result.islands.filter(i => i.kind === 'shed_no_generation').flatMap(i => i.buses))
  const pos = project(network)
  const flowVals = Object.values(result.flows).map(Math.abs)
  const maxFlow = Math.max(...(flowVals.length ? flowVals : [0]), 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`IEEE case30 network, ${infeasible ? 'infeasible: no valid dispatch' : removedBus !== null ? `bus ${removedBus} removed` : 'baseline dispatch'}`}
      style={{ background: '#080D13', width: '100%', fontFamily: "'Archivo Variable','Arial Narrow','Roboto Condensed',system-ui,sans-serif" }}>
      <g>
        {network.lines.map(l => {
          const a = pos[l.from_bus], b = pos[l.to_bus]
          const outaged = disabledLines.includes(l.idx) // distinct from bus-removal adjacency: this one is independently restorable
          const dead = l.from_bus === removedBus || l.to_bus === removedBus || outaged
          // Restorable (outaged, not merely adjacent to a removed bus) lines stay keyboard/click-interactive
          // so a line taken out via LineOutage can be put back from the SVG, not only its <select>.
          if (dead && outaged) return <g key={l.idx} data-testid="line" data-line={l.idx} data-outaged="true"
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Line ${l.idx}, out of service. Press Enter to restore.`}
            onClick={() => onRestoreLine?.(l.idx)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRestoreLine?.(l.idx) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E0645A" strokeWidth={1} strokeDasharray="1 5" opacity={0.6} />
          </g>
          if (dead) return <line key={l.idx} data-testid="line" data-line={l.idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E0645A" strokeWidth={1} strokeDasharray="1 5" opacity={0.6} />
          if (infeasible) return <g key={l.idx} data-testid="line" data-line={l.idx} data-binding="n/a" data-altered={alteredLines.includes(l.idx)}
            role="button" tabIndex={0} aria-pressed={selectedLine === l.idx} style={{ cursor: 'pointer' }}
            aria-label={`Line ${l.idx}, flow n/a (infeasible). Press Enter to select for capacity.`}
            onClick={() => onSelectLine?.(l.idx)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLine?.(l.idx) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E0645A" strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
          </g>
          const f = Math.abs(result.flows[l.idx] ?? 0)
          // binding comes from the Worker's binding_lines, never computed here.
          const binding = result.binding_lines.includes(l.idx)
          const sel = selectedLine === l.idx
          return <g key={l.idx} data-testid="line" data-line={l.idx} data-binding={binding ? 'binding' : 'slack'}
            data-altered={alteredLines.includes(l.idx)} role="button" tabIndex={0} aria-pressed={sel} style={{ cursor: 'pointer' }}
            aria-label={`Line ${l.idx}, ${binding ? 'binding' : 'slack'}, ${f.toFixed(2)} of ${(result.line_rating_mw[l.idx] ?? l.rating_mw).toFixed(2)} MW. Press Enter to select for capacity.`}
            onClick={() => onSelectLine?.(l.idx)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLine?.(l.idx) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            {sel && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#6FA9BE" strokeWidth={9} opacity={0.35} />}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={binding ? '#E0645A' : f > 0.01 ? '#EF9C54' : '#5E6B78'} strokeWidth={1 + 4 * f / maxFlow} strokeLinecap="round"
              strokeDasharray={binding ? '6 3' : undefined} />
          </g>
        })}
      </g>
      <g>
        {/* CAS-INT-004: SYNTHETIC candidate lines (candidate_lines.json), idx = network.lines.length +
            position. Added ones render like a live line but in a distinct accent (#7FD6B0) so they read
            as "new infrastructure", not baseline topology; not-yet-added ones render as a thin dotted
            "available to add" ghost, clickable to add directly from the graph. */}
        {candidates.map((cl, k) => {
          const idx = network.lines.length + k
          const a = pos[cl.from_bus], b = pos[cl.to_bus]
          const added = addedLines.includes(k)
          if (!added) return <g key={`cand-${k}`} data-testid="candidate-line" data-candidate={k} data-added="false"
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Candidate line ${k} (${network.buses[cl.from_bus].name}-${network.buses[cl.to_bus].name}), not added. Press Enter to add.`}
            onClick={() => onToggleCandidate?.(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCandidate?.(k) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7FD6B0" strokeWidth={1} strokeDasharray="2 4" opacity={0.35} />
          </g>
          if (infeasible) return <g key={`cand-${k}`} data-testid="candidate-line" data-candidate={k} data-added="true"
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Candidate line ${k}, flow n/a (infeasible). Press Enter to remove.`}
            onClick={() => onToggleCandidate?.(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCandidate?.(k) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#7FD6B0" strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
          </g>
          const f = Math.abs(result.flows[idx] ?? 0)
          const binding = result.binding_lines.includes(idx)
          return <g key={`cand-${k}`} data-testid="candidate-line" data-candidate={k} data-added="true" data-binding={binding ? 'binding' : 'slack'}
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Candidate line ${k} (added), ${binding ? 'binding' : 'slack'}, ${f.toFixed(2)} of ${(result.line_rating_mw[idx] ?? cl.rating_mw).toFixed(2)} MW. Press Enter to remove.`}
            onClick={() => onToggleCandidate?.(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCandidate?.(k) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={binding ? '#E0645A' : '#7FD6B0'} strokeWidth={1 + 4 * f / maxFlow} strokeLinecap="round"
              strokeDasharray={binding ? '6 3' : undefined} />
          </g>
        })}
      </g>
      <g>
        {network.buses.map(b => {
          const removed = b.idx === removedBus
          if (!removed && infeasible) {
            return <g key={b.idx} data-testid="bus" data-bus={b.idx} data-state="infeasible" transform={`translate(${pos[b.idx].x} ${pos[b.idx].y})`}
              role="button" tabIndex={0} aria-pressed={selectedBus === b.idx} style={{ cursor: 'pointer' }}
              aria-label={`Bus ${b.name}, status n/a (infeasible). Press Enter to select for removal.`}
              onClick={() => onSelect?.(b.idx)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(b.idx) } }}>
              {selectedBus === b.idx && <circle r={12} fill="none" stroke="#E0645A" strokeWidth={2} />}
              <circle r={7} fill="#080D13" stroke="#E0645A" strokeWidth={2} strokeDasharray="2 2" />
              <text y={-15} textAnchor="middle" fontSize={11} fill="#9AA5B1">{b.name}</text>
            </g>
          }
          const isolated = noGen.has(b.idx)
          const shed = (result.shed[b.idx] ?? 0) > 0
          const state = removed ? 'removed' : isolated ? 'shed_no_generation' : shed ? 'shed_economic' : 'served'
          const stroke = removed ? '#E0645A' : state === 'served' ? '#EF9C54' : '#6FA9BE'
          return (
            <g key={b.idx} data-testid="bus" data-bus={b.idx} data-state={state} transform={`translate(${pos[b.idx].x} ${pos[b.idx].y})`}
              role="button" tabIndex={0} aria-pressed={selectedBus === b.idx} style={{ cursor: 'pointer' }}
              aria-label={`Bus ${b.name}, ${state.replace(/_/g, ' ')}. Press Enter to select for removal.`}
              onClick={() => onSelect?.(b.idx)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(b.idx) } }}>
              {selectedBus === b.idx && <circle r={12} fill="none" stroke="#E0645A" strokeWidth={2} />}
              <circle r={7} fill={isolated ? '#3E6A7B' : '#080D13'} stroke={stroke} strokeWidth={2}
                strokeDasharray={isolated ? '3 2' : undefined} />
              {removed && <path d="M-5-5L5 5M5-5L-5 5" stroke={stroke} strokeWidth={2} />}
              <text y={-15} textAnchor="middle" fontSize={11} fill="#9AA5B1">{b.name}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
