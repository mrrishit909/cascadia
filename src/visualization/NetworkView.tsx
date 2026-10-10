import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CandidateLine } from '../engine/dcopf'
import type { Case30, SolveResult } from '../engine/types'

const W = 960, H = 640, PAD = 40
// Portrait target box: ART_DIRECTION.md handoff item 7 requires a separate, hand-computed portrait
// layout for chapters 1 and 6 at tablet/mobile widths, "not scaled down from landscape". A plain
// viewBox crop of the landscape layout would just show a thin vertical slice of a wide network; instead
// `project(network, { portrait: true })` rotates the raw pandapower geodata 90 degrees before fitting
// to this portrait-shaped box, producing a genuinely different composition (tall structure, not a
// squeezed wide one) from the same underlying point cloud -- computed once, frozen, versioned with the
// fixture, same as the landscape layout.
const PORTRAIT_W = 640, PORTRAIT_H = 960

export interface Camera { x: number; y: number; w: number; h: number }

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
// `portrait`: rotates the raw (x,y) point cloud 90 degrees before fitting to a portrait-shaped target
// box (PORTRAIT_W x PORTRAIT_H), instead of fitting the unrotated cloud into a landscape box -- a real,
// different composition computed from the same source data, not a CSS-level rescale of the landscape
// layout.
function project(network: Case30, portrait = false) {
  const rawXs = network.buses.map(b => b.x), rawYs = network.buses.map(b => b.y)
  const [xs, ys] = portrait ? [rawYs, rawXs] : [rawXs, rawYs] // 90-degree rotation: swap axes
  const boxW = portrait ? PORTRAIT_W : W, boxH = portrait ? PORTRAIT_H : H
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const k = Math.min((boxW - 2 * PAD) / (Math.max(...xs) - x0), (boxH - 2 * PAD) / (Math.max(...ys) - y0))
  return network.buses.map((_, i) => ({ x: PAD + (xs[i] - x0) * k, y: boxH - PAD - (ys[i] - y0) * k }))
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

interface Props { network: Case30; result: SolveResult; removedBus?: number | null; selectedBus?: number | null; onSelect?: (bus: number) => void; selectedLine?: number | null; onSelectLine?: (line: number) => void; alteredLines?: number[]; disabledLines?: number[]; onRestoreLine?: (line: number) => void; candidates?: CandidateLine[]; addedLines?: number[]; onToggleCandidate?: (pos: number) => void
  // docs/planning/cascadia/CHAPTER_ARCHITECTURE.md section 2: "one persistent stage" means the one
  // CANONICAL interactive instance. Chapter 3's locator inset and chapter 5's mini networks are a
  // separate presentational variant of the SAME lineVisual/color/glow logic, not a hand-rolled second
  // copy that could drift -- interactive=false strips role/tabIndex/testid/focus-ring/selection-bracket
  // treatment (an inset/mini has no hit targets, no keyboard nav, nothing to select) and marks the
  // whole <svg> aria-hidden (decorative/informational only -- the one interactive stage is what AT
  // users navigate; duplicating the same announcements across up to 4 simultaneous instances would be
  // confusing noise, not help).
  interactive?: boolean
  // Chapter shell: the stage persists across every chapter (CHAPTER_ARCHITECTURE.md section 2) and
  // changes only via transform/camera, never remounts. `camera` sets the SVG viewBox sub-rect within
  // the fixed W x H (or portrait PORTRAIT_W x PORTRAIT_H) coordinate space -- e.g. chapter 2 pans to
  // frame cols 6-12 at a smaller scale. On-screen SIZE (how big the <svg> renders in the page, e.g.
  // chapter 3's small locator inset) is a separate concern, controlled by the parent chapter's own CSS
  // around this component, not by NetworkView. Defaults to the full extent (the whole network visible,
  // today's only behavior).
  camera?: Camera
  // `docs/ART_DIRECTION.md` section 3's responsive compositions table: portrait layouts (tablet/mobile
  // chapters 1 and 6) use a separately computed layout, not a scaled-down landscape one. Switches which
  // `project()` box/rotation is used; the resulting coordinate space is PORTRAIT_W x PORTRAIT_H instead
  // of W x H, so a `camera` passed alongside `orientation="portrait"` must be expressed in THAT space.
  orientation?: 'landscape' | 'portrait' }
export function NetworkView({ network, result, removedBus = null, selectedBus = null, onSelect, selectedLine = null, onSelectLine, alteredLines = [], disabledLines = [], onRestoreLine, candidates = [], addedLines = [], onToggleCandidate, interactive = true, camera, orientation = 'landscape' }: Props) {
  const reactId = useId()
  const boxW = orientation === 'portrait' ? PORTRAIT_W : W
  const boxH = orientation === 'portrait' ? PORTRAIT_H : H
  const activeCamera = camera ?? { x: 0, y: 0, w: boxW, h: boxH }
  const testid = interactive ? 'line' : 'mini-line'
  const busTestid = interactive ? 'bus' : 'mini-bus'
  const candTestid = interactive ? 'candidate-line' : 'mini-candidate-line'

  // docs/ART_DIRECTION.md section 1 ("Navigation") and DESIGN_SYSTEM.json's selectableElement.focusVisible
  // both require roving-tabindex keyboard navigation on the stage: only ONE bus/line/candidate is a Tab
  // stop at a time (everything else is tabIndex=-1), and Arrow keys move that single stop along topology
  // neighbors -- a bus's incident lines, a line's two endpoint buses. Without this, Tabbing through the
  // ~71-element network (30 buses + 41 lines) to reach one specific element is the ONLY way in, which is
  // why e2e/cas_substation_remove_keyboard.spec.ts previously had to Tab up to 200 times to reach a bus;
  // Arrow-key topology navigation is the real spec, not an optimization.
  //
  // `neighbors`: adjacency built once per network/candidates change, keyed by the same "kind:idx" string
  // used for data-testid/ref lookups (`bus:N`, `line:N`, `cand:K`). `cursorByKey` is a ref (not state) so
  // moving away from a bus and back resumes cycling through its incident lines where it left off, rather
  // than always landing on the same first neighbor -- a plain "always neighbor[0]" rule would make lines
  // 2+ of a higher-degree bus unreachable by repeated same-direction presses.
  const neighbors = useMemo(() => {
    const m = new Map<string, string[]>()
    const addEdge = (a: string, b: string) => { if (!m.has(a)) m.set(a, []); m.get(a)!.push(b) }
    for (const l of network.lines) {
      const lk = `line:${l.idx}`, fb = `bus:${l.from_bus}`, tb = `bus:${l.to_bus}`
      addEdge(lk, fb); addEdge(lk, tb); addEdge(fb, lk); addEdge(tb, lk)
    }
    candidates.forEach((cl, k) => {
      const lk = `cand:${k}`, fb = `bus:${cl.from_bus}`, tb = `bus:${cl.to_bus}`
      addEdge(lk, fb); addEdge(lk, tb); addEdge(fb, lk); addEdge(tb, lk)
    })
    return m
  }, [network, candidates])
  const [rovingKey, setRovingKey] = useState(() => `bus:${network.buses[0]?.idx ?? 0}`)
  const cursorByKey = useRef(new Map<string, number>())
  const elRefs = useRef(new Map<string, SVGGElement>())
  const registerRef = (key: string) => (el: SVGGElement | null) => { if (el) elRefs.current.set(key, el); else elRefs.current.delete(key) }
  const moveRoving = (dir: 1 | -1) => {
    const ns = neighbors.get(rovingKey)
    if (!ns || ns.length === 0) return
    const cur = cursorByKey.current.get(rovingKey) ?? 0
    const sel = ((cur % ns.length) + ns.length) % ns.length
    cursorByKey.current.set(rovingKey, cur + dir)
    setRovingKey(ns[sel])
  }
  // Only move REAL browser focus to the new roving element on a genuine change (arrow-key navigation or
  // a click/programmatic focus syncing rovingKey via onFocus below) -- never on initial mount, which
  // would otherwise steal page focus the instant the stage renders (same class of bug independent review
  // found and fixed in LineOutage.tsx: an effect with no "did this actually change" guard fires once on
  // every mount too, not just on later transitions).
  const prevRovingKey = useRef(rovingKey)
  useEffect(() => {
    if (prevRovingKey.current === rovingKey) return
    prevRovingKey.current = rovingKey
    elRefs.current.get(rovingKey)?.focus()
  }, [rovingKey])
  // Spread onto a <g> to add role/tabIndex/handlers/aria-pressed only when interactive; {} otherwise.
  // `onFocus` keeps `rovingKey` in sync with whatever the browser ACTUALLY focused (a direct click, not
  // just Arrow nav) -- without it, clicking a non-roving element would leave the DOM's real focus and
  // this component's roving model disagreeing about which element is "current," and the next Arrow press
  // would silently navigate from the wrong base element.
  const hit = (key: string, ariaLabel: string, ariaPressed: boolean, onClick: () => void, onKeyDown: (e: React.KeyboardEvent) => void) =>
    interactive ? {
      role: 'button' as const, tabIndex: key === rovingKey ? 0 : -1, 'aria-pressed': ariaPressed, 'aria-label': ariaLabel,
      style: { cursor: 'pointer' }, ref: registerRef(key), onClick, onFocus: () => setRovingKey(key),
      onKeyDown: (e: React.KeyboardEvent) => {
        onKeyDown(e)
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); moveRoving(1) }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); moveRoving(-1) }
      },
    } : {}
  const keyToClick = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() } }
  // D2: when infeasible, result.flows/shed/islands are all empty (there is no dispatch), so the old code
  // fell through to "no flow -> grey, not shed -> served", rendering a network that looks fully healthy.
  // Every line/bus gets an explicit infeasible treatment instead -- never derived from an empty flows/shed
  // object standing in for "zero". See verification/NO_FAKE_NUMBERS_AUDIT.md #6 / PROTOTYPE_REPORT.md D2.
  const infeasible = result.status === 'infeasible'
  const noGen = useMemo(() => new Set(result.islands.filter(i => i.kind === 'shed_no_generation').flatMap(i => i.buses)), [result])
  const pos = useMemo(() => project(network, orientation === 'portrait'), [network, orientation])
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
    <svg viewBox={`${activeCamera.x} ${activeCamera.y} ${activeCamera.w} ${activeCamera.h}`} role={interactive ? 'group' : undefined} aria-hidden={interactive ? undefined : true}
      aria-label={interactive ? `IEEE case30 network, ${infeasible ? 'infeasible: no valid dispatch' : removedBus !== null ? `bus ${removedBus} removed` : 'baseline dispatch'}` : undefined}
      style={{ background: '#080D13', width: '100%', fontFamily: "'Archivo Variable','Arial Narrow','Roboto Condensed',system-ui,sans-serif" }}>
      <style>{`.nf-ring{opacity:0;pointer-events:none}g[tabindex]:focus-visible>.nf-ring{opacity:1}`}</style>
      <defs>
        {/* glow.filter: "copper-bloom", exact primitives from DESIGN_SYSTEM.json. Region bounded to
            the FULL network bbox plus 8px regardless of the active camera (glow.filter.filterUnits) --
            the filter region must cover every glow line that might be visible as the camera pans/zooms,
            not just what's in view right now. */}
        <filter id={filterId} x={-8} y={-8} width={boxW + 16} height={boxH + 16} filterUnits="userSpaceOnUse">
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
          if (dead && outaged) return <g key={l.idx} data-testid={testid} data-line={l.idx} data-outaged="true"
            {...hit(`line:${l.idx}`, `Line ${l.idx}, out of service. Press Enter to restore.`, false, () => onRestoreLine?.(l.idx), keyToClick(() => onRestoreLine?.(l.idx)))}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={DE_ENERGIZED} strokeWidth={1} strokeDasharray="1 3" opacity={0.6} />
            {interactive && lineFocusRing(a.x, a.y, b.x, b.y, 0.5)}
          </g>
          if (dead) return <line key={l.idx} data-testid={testid} data-line={l.idx} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={DE_ENERGIZED} strokeWidth={1} strokeDasharray="1 3" opacity={0.6} />
          if (infeasible) return <g key={l.idx} data-testid={testid} data-line={l.idx} data-binding="n/a" data-altered={alteredLines.includes(l.idx)}
            {...hit(`line:${l.idx}`, `Line ${l.idx}, flow n/a (infeasible). Press Enter to select for capacity.`, selectedLine === l.idx, () => onSelectLine?.(l.idx), keyToClick(() => onSelectLine?.(l.idx)))}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={FAULT} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
            {interactive && lineFocusRing(a.x, a.y, b.x, b.y, 0.75)}
            {interactive && selectedLine === l.idx && lineBrackets(a.x, a.y, b.x, b.y, `sel-inf-${l.idx}`)}
          </g>
          const f = Math.abs(result.flows[l.idx] ?? 0)
          // binding comes from the Worker's binding_lines, never computed here.
          const binding = result.binding_lines.includes(l.idx)
          const sel = selectedLine === l.idx
          const rating = result.line_rating_mw[l.idx] ?? l.rating_mw
          const deEnergized = noGen.has(l.from_bus) || noGen.has(l.to_bus)
          const v = lineVisual(f, rating, binding, deEnergized)
          const width = 1 + 4 * f / maxFlow
          return <g key={l.idx} data-testid={testid} data-line={l.idx} data-binding={binding ? 'binding' : 'slack'}
            data-altered={alteredLines.includes(l.idx)}
            {...hit(`line:${l.idx}`, `Line ${l.idx}, ${binding ? 'binding' : 'slack'}, ${f.toFixed(2)} of ${rating.toFixed(2)} MW. Press Enter to select for capacity.`, sel, () => onSelectLine?.(l.idx), keyToClick(() => onSelectLine?.(l.idx)))}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            {/* networkEncoding.bindingLine: copperHot core with a copper casing either side (double rule) */}
            {v.casing && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.casing} strokeWidth={width + 2} strokeLinecap="round" />}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={v.dash} />
            {interactive && lineFocusRing(a.x, a.y, b.x, b.y, width / 2 + (v.casing ? 1 : 0))}
            {interactive && sel && lineBrackets(a.x, a.y, b.x, b.y, `sel-${l.idx}`)}
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
          if (!added) return <g key={`cand-${k}`} data-testid={candTestid} data-candidate={k} data-added="false"
            {...hit(`cand:${k}`, `Candidate line ${k} (${network.buses[cl.from_bus].name}-${network.buses[cl.to_bus].name}), not added. Press Enter to add.`, false, () => onToggleCandidate?.(k), keyToClick(() => onToggleCandidate?.(k)))}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={DIAGNOSTIC_DIM} strokeWidth={1} strokeDasharray="6 4" opacity={0.35} />
            {interactive && lineFocusRing(a.x, a.y, b.x, b.y, 0.5)}
          </g>
          if (infeasible) return <g key={`cand-${k}`} data-testid={candTestid} data-candidate={k} data-added="true"
            {...hit(`cand:${k}`, `Candidate line ${k}, flow n/a (infeasible). Press Enter to remove.`, false, () => onToggleCandidate?.(k), keyToClick(() => onToggleCandidate?.(k)))}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={FAULT} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.5} />
            {interactive && lineFocusRing(a.x, a.y, b.x, b.y, 0.75)}
          </g>
          const f = Math.abs(result.flows[idx] ?? 0)
          const binding = result.binding_lines.includes(idx)
          const rating = result.line_rating_mw[idx] ?? cl.rating_mw
          // Added candidates are real topology now: same deEnergized check (removed-bus-adjacent or
          // inside a no-generation island) as any base line, not a special case.
          const deEnergizedCand = cl.from_bus === removedBus || cl.to_bus === removedBus || noGen.has(cl.from_bus) || noGen.has(cl.to_bus)
          const v = lineVisual(f, rating, binding, deEnergizedCand)
          const width = 1 + 4 * f / maxFlow
          return <g key={`cand-${k}`} data-testid={candTestid} data-candidate={k} data-added="true" data-binding={binding ? 'binding' : 'slack'}
            {...hit(`cand:${k}`, `Candidate line ${k} (added), ${binding ? 'binding' : 'slack'}, ${f.toFixed(2)} of ${rating.toFixed(2)} MW. Press Enter to remove.`, false, () => onToggleCandidate?.(k), keyToClick(() => onToggleCandidate?.(k)))}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
            {v.casing && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.casing} strokeWidth={width + 2} strokeLinecap="round" />}
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={v.stroke} strokeWidth={width} strokeLinecap="round" strokeDasharray={v.dash} />
            {interactive && lineFocusRing(a.x, a.y, b.x, b.y, width / 2 + (v.casing ? 1 : 0))}
          </g>
        })}
      </g>
      <g>
        {network.buses.map(b => {
          const removed = b.idx === removedBus
          if (!removed && infeasible) {
            return <g key={b.idx} data-testid={busTestid} data-bus={b.idx} data-state="infeasible" transform={`translate(${pos[b.idx].x} ${pos[b.idx].y})`}
              {...hit(`bus:${b.idx}`, `Bus ${b.name}, status n/a (infeasible). Press Enter to select for removal.`, selectedBus === b.idx, () => onSelect?.(b.idx), keyToClick(() => onSelect?.(b.idx)))}>
              <circle r={7} fill={INK} stroke={FAULT} strokeWidth={2} strokeDasharray="2 2" />
              {interactive && selectedBus === b.idx && busBrackets(`sel-${b.idx}`)}
              {interactive && busFocusRing()}
              <text y={-15} textAnchor="middle" fontSize={11} fill="#9AA5B1">{b.name}</text>
            </g>
          }
          const isolated = noGen.has(b.idx)
          const shed = (result.shed[b.idx] ?? 0) > 0
          const state = removed ? 'removed' : isolated ? 'shed_no_generation' : shed ? 'shed_economic' : 'served'
          // Removed bus, like removed/outaged lines: deEnergized, not fault red -- fault red means ONLY infeasible.
          const stroke = removed ? DE_ENERGIZED : state === 'served' ? COPPER : DIAGNOSTIC
          return (
            <g key={b.idx} data-testid={busTestid} data-bus={b.idx} data-state={state} transform={`translate(${pos[b.idx].x} ${pos[b.idx].y})`}
              {...hit(`bus:${b.idx}`, `Bus ${b.name}, ${state.replace(/_/g, ' ')}. Press Enter to select for removal.`, selectedBus === b.idx, () => onSelect?.(b.idx), keyToClick(() => onSelect?.(b.idx)))}>
              <circle r={7} fill={isolated ? DIAGNOSTIC_DIM : INK} stroke={stroke} strokeWidth={2}
                strokeDasharray={isolated ? '3 2' : undefined} />
              {removed && <path d="M-5-5L5 5M5-5L-5 5" stroke={stroke} strokeWidth={2} />}
              {interactive && selectedBus === b.idx && busBrackets(`sel-${b.idx}`)}
              {interactive && busFocusRing()}
              <text y={-15} textAnchor="middle" fontSize={11} fill="#9AA5B1">{b.name}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
