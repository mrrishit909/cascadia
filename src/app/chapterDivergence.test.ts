import { describe, expect, it } from 'vitest'
import { chapter2Diverged, chapter3Diverged, chapter4Diverged, chapter5Diverged } from './chapterDivergence'

describe('chapterDivergence', () => {
  it('chapter2: empty maps are not diverged; any key is', () => {
    expect(chapter2Diverged({ loadScale: {}, genPmax: {} })).toBe(false)
    expect(chapter2Diverged({ loadScale: { 3: 1.5 }, genPmax: {} })).toBe(true)
    expect(chapter2Diverged({ loadScale: {}, genPmax: { 1: 20 } })).toBe(true)
  })

  it('chapter2: apply then revert to the default scale clears the key (object-identity bug this replaces)', () => {
    // setLoadScale deletes the key once f is set back to 1 (state.tsx) -- the old `result !== baseline`
    // check this file replaces would stay stuck on "diverged" forever here, since each re-solve
    // allocates a fresh result object even when the scenario itself is back at its starting value.
    const afterApply = { loadScale: { 3: 1.5 }, genPmax: {} }
    expect(chapter2Diverged(afterApply)).toBe(true)
    const afterRevert = { loadScale: {}, genPmax: {} } // key deleted by setLoadScale(bus, 1)
    expect(chapter2Diverged(afterRevert)).toBe(false)
  })

  it('chapter3: capacity map or a non-default allowShed counts', () => {
    expect(chapter3Diverged({ lineCapacity: {}, allowShed: true })).toBe(false)
    expect(chapter3Diverged({ lineCapacity: { 9: 0.75 }, allowShed: true })).toBe(true)
    expect(chapter3Diverged({ lineCapacity: {}, allowShed: false })).toBe(true)
  })

  it('chapter4: a removed bus or any disabled line counts', () => {
    expect(chapter4Diverged({ removedBus: null, disabledLines: [] })).toBe(false)
    expect(chapter4Diverged({ removedBus: 26, disabledLines: [] })).toBe(true)
    expect(chapter4Diverged({ removedBus: null, disabledLines: [33] })).toBe(true)
  })

  it('chapter5: diverged once a ranking exists, even an empty one', () => {
    expect(chapter5Diverged({ ranking: undefined })).toBe(false)
    expect(chapter5Diverged({ ranking: [] })).toBe(true)
  })
})
