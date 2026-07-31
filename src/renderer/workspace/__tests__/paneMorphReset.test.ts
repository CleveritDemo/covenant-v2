/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  clearPaneMorphNodeStyles,
  resetPaneZoomSurfaceState,
} from '../PaneWindow'

describe('pane morph interrupt reset', () => {
  it('resetPaneZoomSurfaceState clears override and zoom mode', () => {
    const setLayoutOverride = vi.fn()
    const setZoomMode = vi.fn()
    const setZoomPrep = vi.fn()

    resetPaneZoomSurfaceState({ setLayoutOverride, setZoomMode, setZoomPrep })

    expect(setLayoutOverride).toHaveBeenCalledWith(null)
    expect(setZoomMode).toHaveBeenCalledWith('idle')
    expect(setZoomPrep).toHaveBeenCalledWith(false)
  })

  it('clearPaneMorphNodeStyles strips inline morph styles', () => {
    const node = document.createElement('div')
    node.style.transform = 'scale(0.5)'
    node.style.borderRadius = '8px'
    node.style.transition = 'none'
    node.style.transformOrigin = 'top left'

    clearPaneMorphNodeStyles(node)

    expect(node.style.transform).toBe('')
    expect(node.style.borderRadius).toBe('')
    expect(node.style.transition).toBe('')
    expect(node.style.transformOrigin).toBe('')
  })
})
