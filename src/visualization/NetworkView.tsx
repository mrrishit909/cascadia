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

interface Props { network: Case30; result: SolveResult; removedBus?: number | null; selectedBus?: number | null; onSelect?: (bus: number) => void }
export function NetworkView({ network, result, removedBus = null, selectedBus = null, onSelect }: Props) {
  const noGen = new Set(result.islands.filter(i => i.kind === 'shed_no_generation').flatMap(i => i.buses))
  const pos = project(network)
  const maxFlow = Math.max(...Object.values(result.flows).map(Math.abs), 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="IEEE case30 network, baseline dispatch"
      style={{ background: '#080D13', width: '100%', fontFamily: "'Archivo Variable','Arial Narrow','Roboto Condensed',system-ui,sans-serif" }}>
      <g>
        {network.lines.map(l => {
          const f = Math.abs(result.flows[l.idx] ?? 0)
          const a = pos[l.from_bus], b = pos[l.to_bus]
          const dead = l.from_bus === removedBus || l.to_bus === removedBus
          if (dead) return <line key={l.idx} data-testid="line" data-line={l.idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#E0645A" strokeWidth={1} strokeDasharray="1 5" opacity={0.6} />
          return <line key={l.idx} data-testid="line" data-line={l.idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={f > 0.01 ? '#EF9C54' : '#5E6B78'} strokeWidth={1 + 4 * f / maxFlow} strokeLinecap="round" />
        })}
      </g>
      <g>
        {network.buses.map(b => {
          const removed = b.idx === removedBus, isolated = noGen.has(b.idx)
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
