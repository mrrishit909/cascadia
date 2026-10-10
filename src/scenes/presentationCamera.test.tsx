import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { claimCamera, FULL_CAMERA, resetCameraToDefault, usePresentationCamera } from './presentationCamera'

describe('presentationCamera (centralized ownership, cinematic-motion directive phase 3)', () => {
  it('a write from a non-active scene is dropped, not applied', () => {
    resetCameraToDefault('ch1')
    const target = { x: 10, y: 10, w: 100, h: 100 }
    claimCamera('ch2', 'ch1', target) // ch2 tries to write while ch1 is active -- must be ignored
    let current = FULL_CAMERA
    const Probe = () => { current = usePresentationCamera(); return null }
    render(<Probe />)
    expect(current).toEqual(FULL_CAMERA)
  })

  it('a write from the currently active scene is applied', () => {
    resetCameraToDefault('ch2')
    const target = { x: 10, y: 10, w: 100, h: 100 }
    claimCamera('ch2', 'ch2', target)
    let current = FULL_CAMERA
    const Probe = () => { current = usePresentationCamera(); return null }
    render(<Probe />)
    expect(current).toEqual(target)
  })

  it('resetCameraToDefault restores FULL_CAMERA regardless of what the previous chapter left behind', () => {
    claimCamera('ch2', 'ch2', { x: 10, y: 10, w: 100, h: 100 })
    resetCameraToDefault('ch3')
    let current = { x: -1, y: -1, w: -1, h: -1 }
    const Probe = () => { current = usePresentationCamera(); return null }
    render(<Probe />)
    expect(current).toEqual(FULL_CAMERA)
  })
})
