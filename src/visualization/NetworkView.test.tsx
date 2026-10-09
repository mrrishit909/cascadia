// Verifies the `interactive` prop (architecture-stabilization pass, docs/planning/cascadia/
// CHAPTER_ARCHITECTURE.md section 2) actually strips interactive treatment when false -- not just
// that the default (true, the only path exercised by every other test in this repo) still works.
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NetworkView } from './NetworkView'
import type { Case30, SolveResult } from '../engine/types'

const network: Case30 = JSON.parse(readFileSync('public/data/raw-metadata/case30.json', 'utf8'))
const baseline = JSON.parse(readFileSync('public/data/precomputed/baseline.json', 'utf8'))
const result: SolveResult = baseline.result

describe('NetworkView interactive prop', () => {
  it('interactive=false strips role/tabIndex/testid-as-bus and marks the svg aria-hidden', () => {
    const { container } = render(<NetworkView network={network} result={result} interactive={false} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('role')).toBeNull()
    expect(svg.getAttribute('aria-label')).toBeNull()
    // uses mini-bus/mini-line, not bus/line -- so it can never collide with the interactive stage's
    // own data-testid locators used throughout the rest of the e2e suite
    expect(container.querySelectorAll('[data-testid="bus"]').length).toBe(0)
    expect(container.querySelectorAll('[data-testid="line"]').length).toBe(0)
    const miniBuses = container.querySelectorAll('[data-testid="mini-bus"]')
    expect(miniBuses.length).toBe(network.buses.length)
    for (const el of miniBuses) {
      expect(el.getAttribute('role')).toBeNull()
      expect(el.getAttribute('tabindex')).toBeNull()
      expect(el.getAttribute('aria-label')).toBeNull()
    }
    const miniLines = container.querySelectorAll('[data-testid="mini-line"]')
    expect(miniLines.length).toBeGreaterThan(0)
    for (const el of miniLines) expect(el.getAttribute('role')).toBeNull()
    // no focus-ring or selection-bracket elements at all (nothing to focus or select)
    expect(container.querySelectorAll('.nf-ring').length).toBe(0)
  })

  it('interactive=true (the default) keeps the full treatment -- same assertions, inverted', () => {
    const { container } = render(<NetworkView network={network} result={result} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBeNull()
    expect(svg.getAttribute('role')).toBe('group')
    expect(container.querySelectorAll('[data-testid="bus"]').length).toBe(network.buses.length)
    expect(container.querySelectorAll('[data-testid="mini-bus"]').length).toBe(0)
    const bus = container.querySelector('[data-testid="bus"]')!
    expect(bus.getAttribute('role')).toBe('button')
    expect(bus.getAttribute('tabindex')).toBe('0')
    // focus-ring elements exist (one per bus + one per interactive line, at minimum one per bus)
    expect(container.querySelectorAll('.nf-ring').length).toBeGreaterThanOrEqual(network.buses.length)
  })
})
