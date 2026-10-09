import { useId, useMemo } from 'react'
import type { CandidateLine } from '../engine/dcopf'
import type { Case30, SolveResult } from '../engine/types'

const W = 960, H = 640, PAD = 40

// DESIGN_SYSTEM.json color tokens. Every stroke in this file must come from here, never a
// hand-picked hex -- that ad hoc drift (fault red reused for "at limit"/"removed", a fourth
// accent hue for candidates, diagnostic blue for selection) is exactly the bug this file fixes.
const COPPER = '#EF9C54'
const COPPER_HOT = '#FFD2A1'
const COPPER_DIM = '#9C6639'
const DE_ENERGIZED = '#5E6B78'
const DIAGNOSTIC = '#6FA9BE'
const DIAGNOSTIC_DIM = '#3E6A7B'
const FAULT = '#E0645A'
const TEXT = '#E8E4DC'
const INK = '#080D13'

// Layout: pandapower's schematic geodata for case30 (hand-drawn by the case
// authors to be planar-ish), uniformly scaled to fit, y flipped for SVG.
// ponytail: no force relaxation; add if removed-bus/new-line views need it.
function project(network: Case30) {
  const xs = network.buses.map(b => b.x), ys = network.buses.map(b => b.y)
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const k = Math.min((W - 2 * PAD) / (Math.max(...xs) - x0), (H - 2 * PAD) / (Math.max(...ys) - y0))
  return network.buses.map(b => ({ x: PAD + (b.x - x0) * k, y: H - PAD - (b.y - y0) * k }))
}

// networkEncoding.energizedLine / lowFlowLine / bindingLine / deEnergizedLine, in one place so the
// glow group (duplicated energized strokes) and the live line rendering never disagree on what
// counts as "energized". `deEnergized` covers both the removed/outaged case (passed by the caller)
// and a line sitting entirely inside a no-generation island (0 flow is "dead", not "low flow").
function lineVisual(f: number, rating: number, binding: boolean, deEnergized: boolean) {
  if (deEnergized) return { stroke: DE_ENERGIZED, dash: '4 3' as string | undefined, casing: null as string | null, glow: false }
  if (binding) return { stroke: COPPER_HOT, dash: undefined, casing: COPPER, glow: true }
  if (rating > 0 && f < 0.25 * rating) return { stroke: COPPER_DIM, dash: undefined, casing: null, glow: false }
  return { stroke: COPPER, dash: undefined, casing: null, glow: true }
}

function unit(ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1
  return [dx / len, dy / len]
}

// componentStates.networkFocusRing: a 2px #E8E4DC ring with a 2px #080D13 gap between it and the
// element, distinct from the plain CSS :focus-visible outline in index.css. Drawn for every
// interactive line/bus and shown only on real keyboard focus via the CSS rule below (no React
// focus-tracking state, so it can't be confused with mouse/hover and never forces a graph re-render).
function lineFocusRing(ax: number, ay: number, bx: number, by: number, halfWidth: number) {
  const [ux, uy] = unit(ax, ay, bx, by)
  const [vx, vy] = [-uy, ux]
  const gapOff = halfWidth + 1 // 2px ink gap stroke, hugging the element
  const ringOff = halfWidth + 3 // 2px text ring stroke, outside the gap
  return (
    <g className="nf-ring" aria-hidden="true">
      <line x1={ax + vx * gapOff} y1={ay + vy * gapOff} x2={bx + vx * gapOff} y2={by + vy * gapOff} stroke={INK} strokeWidth={2} />
      <line x1={ax - vx * gapOff} y1={ay - vy * gapOff} x2={bx - vx * gapOff} y2={by - vy * gapOff} stroke={INK} strokeWidth={2} />
      <line x1={ax + vx * ringOff} y1={ay + vy * ringOff} x2={bx + vx * ringOff} y2={by + vy * ringOff} stroke={TEXT} strokeWidth={2} />
      <line x1={ax - vx * ringOff} y1={ay - vy * ringOff} x2={bx - vx * ringOff} y2={by - vy * ringOff} stroke={TEXT} strokeWidth={2} />
    </g>
  )
}
function busFocusRing() {
  return (
    <g className="nf-ring" aria-hidden="true">
      <circle r={9} fill="none" stroke={INK} strokeWidth={2} />
      <circle r={11} fill="none" stroke={TEXT} strokeWidth={2} />
    </g>
  )
}

// networkEncoding.selectionOverlay: four #E8E4DC corner brackets. Lines: brackets at both ends
// offset outside the casing. Additive overlay -- never replaces the element's own state stroke.
function lineBrackets(ax: number, ay: number, bx: number, by: number, key: string) {
  const [ux, uy] = unit(ax, ay, bx, by)
  const [vx, vy] = [-uy, ux]
  const offset = 7, arm = 6
  const ends: [number, number, number, number][] = [[ax, ay, ux, uy], [bx, by, -ux, -uy]]
  return ends.flatMap(([px, py, iux, iuy], ei) => [1, -1].map(sign => (
    <g key={`${key}-${ei}-${sign}`} aria-hidden="true">
      <line x1={px + vx * offset * sign} y1={py + vy * offset * sign}
        x2={px + vx * offset * sign + iux * arm} y2={py + vy * offset * sign + iuy * arm} stroke={TEXT} strokeWidth={1.5} />
      <line x1={px + vx * offset * sign} y1={py + vy * offset * sign}
        x2={px + vx * offset * sign + vx * sign * arm} y2={py + vy * offset * sign + vy * sign * arm} stroke={TEXT} strokeWidth={1.5} />
    </g>
  )))
}
// Buses: brackets on a square 6px outside the ring (r=7).
function busBrackets(key: string) {
  const s = 13, arm = 5
  const corners: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  return corners.map(([sx, sy]) => (
    <g key={`${key}-${sx}-${sy}`} aria-hidden="true">
      <line x1={sx * s} y1={sy * s} x2={sx * s - sx * arm} y2={sy * s} stroke={TEXT} strokeWidth={1.5} />
      <line x1={sx * s} y1={sy * s} x2={sx * s} y2={sy * s - sy * arm} stroke={TEXT} strokeWidth={1.5} />
    </g>
  ))
}

interface Props { network: Case30; result: SolveResult; removedBus?: number | null; selectedBus?: number | null; onSelect?: (bus: number) => void; selectedLine?: number | null; onSelectLine?: (line: number) => void; alteredLines?: number[]; disabledLines?: number[]; onRestoreLine?: (line: number) => void; candidates?: CandidateLine[]; addedLines?: number[]; onToggleCandidate?: (pos: number) => void }
export function NetworkView({ network, result, removedBus = null, selectedBus = null, onSelect, selectedLine = null, onSelectLine, alteredLines = [], disabledLines = [], onRestoreLine, candidates = [], addedLines = [], onToggleCandidate }: Props) {
  const reactId = useId()
  // D2: when infeasible, result.flows/shed/islands are all empty (there is no dispatch), so the old code
  // fell through to "no flow -> grey, not shed -> served", rendering a network that looks fully healthy.
  // Every line/bus gets an explicit infeasible treatment instead -- never derived from an empty flows/shed
  // object standing in for "zero". See verification/NO_FAKE_NUMBERS_AUDIT.md #6 / PROTOTYPE_REPORT.md D2.
  const infeasible = result.status === 'infeasible'
  const noGen = useMemo(() => new Set(result.islands.filter(i => i.kind === 'shed_no_generation').flatMap(i => i.buses)), [result])
  const pos = useMemo(() => project(network), [network])
  const flowVals = Object.values(result.flows).map(Math.abs)
  const maxFlow = Math.max(...(flowVals.length ? flowVals : [0]), 1)

  // glow.performanceRules: one duplicated group of energized strokes, filtered, that only
  // recomputes on solver/topology change -- never per-line inline, never keyed on hover/selection/focus.
  // Width matches the live core stroke (same `lineVisual`/width formula) so the halo doesn't flatten
  // the flow-width encoding into a uniform line.
  const glowLines = useMemo(() => {
    if (infeasible) return [] as { x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }[]
    const out: { x1: number; y1: number; x2: number; y2: number; stroke: string; width: number }[] = []
    for (const l of network.lines) {
      if (l.from_bus === removedBus || l.to_bus === removedBus || disabledLines.includes(l.idx)) continue
      const deEnergized = noGen.has(l.from_bus) || noGen.has(l.to_bus)
      const f = Math.abs(result.flows[l.idx] ?? 0)
      const rating = result.line_rating_mw[l.idx] ?? l.rating_mw
      const binding = result.binding_lines.includes(l.idx)
      const v = lineVisual(f, rating, binding, deEnergized)
      if (!v.glow) continue
      const a = pos[l.from_bus], b = pos[l.to_bus]
      out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: v.stroke, width: 1 + 4 * f / maxFlow })
    }
    candidates.forEach((cl, k) => {
      if (!addedLines.includes(k)) return
      const idx = network.lines.length + k
      const deEnergized = cl.from_bus === removedBus || cl.to_bus === removedBus || noGen.has(cl.from_bus) || noGen.has(cl.to_bus)
      const f = Math.abs(result.flows[idx] ?? 0)
      const rating = result.line_rating_mw[idx] ?? cl.rating_mw
      const binding = result.binding_lines.includes(idx)
      const v = lineVisual(f, rating, binding, deEnergized)
      if (!v.glow) return
      const a = pos[cl.from_bus], b = pos[cl.to_bus]
      out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: v.stroke, width: 1 + 4 * f / maxFlow })
    })
    return out
  }, [network, result, removedBus, disabledLines, candidates, addedLines, infeasible, noGen, pos, maxFlow])

  // Unique per mount: docs/ART_DIRECTION.md puts a locator inset (chapter 3) and small-multiple mini
  // networks (chapter 5) alongside the main stage, i.e. more than one <svg> with this filter on the
  // page at once. A hardcoded id="copper-bloom" would make every url(#copper-bloom) resolve to
  // whichever <filter> happens to be first in the DOM, silently breaking the glow on every other
  // instance. Flagged by advisor review before it could become a real multi-SVG bug.
  // useId() output contains colons (e.g. ":r1:"), which are valid in SVG ids but unsafe inside a CSS
  // url(#...) reference in some browsers -- stripped here rather than relying on every consumer to know this.
  const filterId = `copper-bloom-${reactId.replace(/:/g, '')}`
  return (
    // role="group", not role="img": this SVG contains focusable interactive descendants (every bus and
    // line), and role="img" tells assistive tech to treat the whole subtree as a flat, non-interactive
    // picture -- a real WCAG 4.1.2 violation (axe-core's "nested-interactive" rule, serious impact),
    // found by a dedicated a11y audit (e2e/a11y.spec.ts) rather than assumed fixed by the rest of this pass.
    <svg viewBox={`0 0 ${W} ${H}`} role="group"
      aria-label={`IEEE case30 network, ${infeasible ? 'infeasible: no valid dispatch' : removedBus !== null ? `bus ${removedBus} removed` : 'baseline dispatch'}`}
      style={{ background: '#080D13', width: '100%', fontFamily: "'Archivo Variable','Arial Narrow','Roboto Condensed',system-ui,sans-serif" }}>
      <style>{`.nf-ring{opacity:0;pointer-events:none}g[tabindex]:focus-visible>.nf-ring{opacity:1}`}</style>
      <defs>
        {/* glow.filter: "copper-bloom", exact primitives from DESIGN_SYSTEM.json. Region bounded to
            the network bbox plus 8px (glow.filter.filterUnits). Never applied to text/background/legend. */}
        <filter id={filterId} x={-8} y={-8} width={W + 16} height={H + 16} filterUnits="userSpaceOnUse">
          <feGaussianBlur in="SourceGraphic" stdDeviation={2.5} result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 0.65 0 0 0  0 0 0.35 0 0  0 0 0 0.55 0" result="tint" />
          <feMerge>
            <feMergeNode in="tint" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* zOrder: network-glow sits under network-core. Duplicated strokes only, no testids, no
          pointer events -- the interactive strokes below remain the only hit targets. */}
      {glowLines.length > 0 && (
        <g filter={`url(#${filterId})`} aria-hidden="true" pointerEvents="none">
          {glowLines.map((gl, i) => <line key={i} x1={gl.x1} y1={gl.y1} x2={gl.x2} y2={gl.y2} stroke={gl.stroke} strokeWidth={gl.width} strokeLinecap="round" />)}
        </g>
      )}
      <g>
        {network.lines.map(l => {
          const a = pos[l.from_bus], b = pos[l.to_bus]
          const outaged = disabledLines.includes(l.idx) // distinct from bus-removal adjacency: this one is independently restorable
          const dead = l.from_bus === removedBus || l.to_bus === removedBus || outaged
          // Restorable (outaged, not merely adjacent to a removed bus) lines stay keyboard/click-interactive
          // so a line taken out via LineOutage can be put back from the SVG, not only its <select>.
          // networkEncoding.removedElement: deEnergized stroke, dash "1 3" -- fault red means ONLY infeasible.
          if (dead && outaged) return <g key={l.idx} data-testid="line" data-line={l.idx} data-outaged="true"
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Line ${l.idx}, out of service. Press Enter to restore.`}
            onClick={() => onRestoreLine?.(l.idx)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRestoreLine?.(l.idx) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={DE_ENERGIZED} strokeWidth={1} strokeDasharray="1 3" opacity={0.6} />
            {lineFocusRing(a.x, a.y, b.x, b.y, 0.5)}
          </g>
          if (dead) return <line key={l.idx} data-testid="line" data-line={l.idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={DE_ENERGIZED} strokeWidth={1} strokeDasharray="1 3" opacity={0.6} />
          if (infeasible) return <g key={l.idx} data-testid="line" data-line={l.idx} data-binding="n/a" data-altered={alteredLines.includes(l.idx)}
            role="button" tabIndex={0} aria-pressed={selectedLine === l.idx} style={{ cursor: 'pointer' }}
            aria-label={`Line ${l.idx}, flow n/a (infeasible). Press Enter to select for capacity.`}
            onClick={() => onSelectLine?.(l.idx)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLine?.(l.idx) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={FAULT} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
            {lineFocusRing(a.x, a.y, b.x, b.y, 0.75)}
            {selectedLine === l.idx && lineBrackets(a.x, a.y, b.x, b.y, `sel-inf-${l.idx}`)}
          </g>
          const f = Math.abs(result.flows[l.idx] ?? 0)
          // binding comes from the Worker's binding_lines, never computed here.
          const binding = result.binding_lines.includes(l.idx)
          const sel = selectedLine === l.idx
          const rating = result.line_rating_mw[l.idx] ?? l.rating_mw
          const deEnergized = noGen.has(l.from_bus) || noGen.has(l.to_bus)
          const v = lineVisual(f, rating, binding, deEnergized)
          const width = 1 + 4 * f / maxFlow
          return <g key={l.idx} data-testid="line" data-line={l.idx} data-binding={binding ? 'binding' : 'slack'}
            data-altered={alteredLines.includes(l.idx)} role="button" tabIndex={0} aria-pressed={sel} style={{ cursor: 'pointer' }}
            aria-label={`Line ${l.idx}, ${binding ? 'binding' : 'slack'}, ${f.toFixed(2)} of ${rating.toFixed(2)} MW. Press Enter to select for capacity.`}
            onClick={() => onSelectLine?.(l.idx)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectLine?.(l.idx) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            {/* networkEncoding.bindingLine: copperHot core with a copper casing either side (double rule) */}
            {v.casing && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.casing} strokeWidth={width + 2} strokeLinecap="round" />}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={v.dash} />
            {lineFocusRing(a.x, a.y, b.x, b.y, width / 2 + (v.casing ? 1 : 0))}
            {sel && lineBrackets(a.x, a.y, b.x, b.y, `sel-${l.idx}`)}
          </g>
        })}
      </g>
      <g>
        {/* CAS-INT-004: candidate lines (candidate_lines.json), idx = network.lines.length + position.
            Not-yet-added candidates render as diagnosticDim/dash "6 4" (networkEncoding.candidateLine) --
            never a fourth accent hue. Added candidates are real topology: same energized/binding/
            low-flow logic as any other line (lineVisual), not a distinct "new infrastructure" color. */}
        {candidates.map((cl, k) => {
          const idx = network.lines.length + k
          const a = pos[cl.from_bus], b = pos[cl.to_bus]
          const added = addedLines.includes(k)
          if (!added) return <g key={`cand-${k}`} data-testid="candidate-line" data-candidate={k} data-added="false"
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Candidate line ${k} (${network.buses[cl.from_bus].name}-${network.buses[cl.to_bus].name}), not added. Press Enter to add.`}
            onClick={() => onToggleCandidate?.(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCandidate?.(k) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={DIAGNOSTIC_DIM} strokeWidth={1} strokeDasharray="6 4" opacity={0.35} />
            {lineFocusRing(a.x, a.y, b.x, b.y, 0.5)}
          </g>
          if (infeasible) return <g key={`cand-${k}`} data-testid="candidate-line" data-candidate={k} data-added="true"
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Candidate line ${k}, flow n/a (infeasible). Press Enter to remove.`}
            onClick={() => onToggleCandidate?.(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCandidate?.(k) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={FAULT} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
            {lineFocusRing(a.x, a.y, b.x, b.y, 0.75)}
          </g>
          const f = Math.abs(result.flows[idx] ?? 0)
          const binding = result.binding_lines.includes(idx)
          const rating = result.line_rating_mw[idx] ?? cl.rating_mw
          // Added candidates are real topology now: same deEnergized check (removed-bus-adjacent or
          // inside a no-generation island) as any base line, not a special case.
          const deEnergizedCand = cl.from_bus === removedBus || cl.to_bus === removedBus || noGen.has(cl.from_bus) || noGen.has(cl.to_bus)
          const v = lineVisual(f, rating, binding, deEnergizedCand)
          const width = 1 + 4 * f / maxFlow
          return <g key={`cand-${k}`} data-testid="candidate-line" data-candidate={k} data-added="true" data-binding={binding ? 'binding' : 'slack'}
            role="button" tabIndex={0} aria-pressed={false} style={{ cursor: 'pointer' }}
            aria-label={`Candidate line ${k} (added), ${binding ? 'binding' : 'slack'}, ${f.toFixed(2)} of ${rating.toFixed(2)} MW. Press Enter to remove.`}
            onClick={() => onToggleCandidate?.(k)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCandidate?.(k) } }}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            {v.casing && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.casing} strokeWidth={width + 2} strokeLinecap="round" />}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={v.dash} />
            {lineFocusRing(a.x, a.y, b.x, b.y, width / 2 + (v.casing ? 1 : 0))}
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
              <circle r={7} fill={INK} stroke={FAULT} strokeWidth={2} strokeDasharray="2 2" />
              {selectedBus === b.idx && busBrackets(`sel-${b.idx}`)}
              {busFocusRing()}
              <text y={-15} textAnchor="middle" fontSize={11} fill="#9AA5B1">{b.name}</text>
            </g>
          }
          const isolated = noGen.has(b.idx)
          const shed = (result.shed[b.idx] ?? 0) > 0
          const state = removed ? 'removed' : isolated ? 'shed_no_generation' : shed ? 'shed_economic' : 'served'
          // Removed bus, like removed/outaged lines: deEnergized, not fault red -- fault red means ONLY infeasible.
          const stroke = removed ? DE_ENERGIZED : state === 'served' ? COPPER : DIAGNOSTIC
          return (
            <g key={b.idx} data-testid="bus" data-bus={b.idx} data-state={state} transform={`translate(${pos[b.idx].x} ${pos[b.idx].y})`}
              role="button" tabIndex={0} aria-pressed={selectedBus === b.idx} style={{ cursor: 'pointer' }}
              aria-label={`Bus ${b.name}, ${state.replace(/_/g, ' ')}. Press Enter to select for removal.`}
              onClick={() => onSelect?.(b.idx)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(b.idx) } }}>
              <circle r={7} fill={isolated ? DIAGNOSTIC_DIM : INK} stroke={stroke} strokeWidth={2}
                strokeDasharray={isolated ? '3 2' : undefined} />
              {removed && <path d="M-5-5L5 5M5-5L-5 5" stroke={stroke} strokeWidth={2} />}
              {selectedBus === b.idx && busBrackets(`sel-${b.idx}`)}
              {busFocusRing()}
              <text y={-15} textAnchor="middle" fontSize={11} fill="#9AA5B1">{b.name}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
