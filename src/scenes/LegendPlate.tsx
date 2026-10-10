import type { Case30, Precomputed } from '../engine/types'
import { ChapterTitle } from './ChapterTitle'

// ART_DIRECTION.md section 3: chapter 1's ONLY other element besides the full-bleed network ("cols
// 1-4, bottom, under 20% of area") -- so the chapter title and its one line of prose live INSIDE
// this plate, not as a separate floating block (an earlier version placed them separately and they
// visually collided with the network's own bus labels, caught via a real screenshot). Always
// mounted (project's standing rule against conditionally-rendered chrome), shown/hidden via
// `inert`/CSS opacity exactly like FigIndex/ResetButton/SkipIntro, driven directly by
// `active==='ch1'` since there's no cross-component state to share. Every figure here is read
// straight from state.network/state.baseline.result -- nothing fabricated, nothing animated as a
// count-up (global motion rule 1).
export function LegendPlate({ active, network, baseline }: { active: boolean; network: Case30; baseline: Precomputed }) {
  const served = baseline.result.total_load_mw - baseline.result.total_unserved_mw
  return (
    <div className="legend-plate" data-active={active} inert={!active}>
      <ChapterTitle sceneId="title-ch1" active={active}>FIG. 01 &mdash; Grid formation</ChapterTitle>
      <p className="legend-plate-prose">The IEEE case30 network at baseline dispatch.</p>
      <div className="legend-plate-row"><span>Network</span><span>{network.buses.length} buses, {network.lines.length} lines</span></div>
      <div className="legend-plate-row"><span>Baseline dispatch</span><span>{served.toFixed(1)} of {baseline.result.total_load_mw.toFixed(1)} MW served</span></div>
      <div className="legend-plate-row"><span>Status</span><span>{baseline.result.status}</span></div>
    </div>
  )
}
