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

export function NetworkView({ network, result }: { network: Case30; result: SolveResult }) {
  const pos = project(network)
  const maxFlow = Math.max(...Object.values(result.flows).map(Math.abs), 1)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="IEEE case30 network, baseline dispatch"
      style={{ background: '#080D13', width: '100%', fontFamily: "'Archivo Variable','Arial Narrow','Roboto Condensed',system-ui,sans-serif" }}>
      <g>
        {network.lines.map(l => {
          const f = Math.abs(result.flows[l.idx] ?? 0)
          const a = pos[l.from_bus], b = pos[l.to_bus]
          return <line key={l.idx} data-testid="line" data-line={l.idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={f > 0.01 ? '#EF9C54' : '#5E6B78'} strokeWidth={1 + 4 * f / maxFlow} strokeLinecap="round" />
        })}
      </g>
      <g>
        {network.buses.map(b => {
          const shed = (result.shed[b.idx] ?? 0) > 0
          return (
            <g key={b.idx} data-testid="bus" data-bus={b.idx} transform={`translate(${pos[b.idx].x} ${pos[b.idx].y})`}>
              <circle r={7} fill="#080D13" stroke={shed ? '#6FA9BE' : '#EF9C54'} strokeWidth={2} strokeDasharray={shed ? '3 2' : undefined} />
              <text y={-11} textAnchor="middle" fontSize={11} fill="#9AA5B1">{b.name}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
