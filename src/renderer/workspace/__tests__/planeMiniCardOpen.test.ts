/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  isPlaneMiniInteractiveTarget,
  markPlaneMiniCardOpenedFromPointer,
  openPlaneMiniCardFromPointerDown,
  shouldSkipPlaneMiniCardClick,
} from '../planeMiniCardOpen'

describe('planeMiniCardOpen', () => {
  it('opens on pointerdown outside interactive controls', () => {
    const onOpen = vi.fn()
    const event = {
      button: 0,
      target: document.createElement('div'),
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent

    openPlaneMiniCardFromPointerDown(event, onOpen)

    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.stopPropagation).toHaveBeenCalled()
  })

  it('skips click after pointerdown open', () => {
    const skip = { current: false }
    markPlaneMiniCardOpenedFromPointer(skip)
    expect(shouldSkipPlaneMiniCardClick(skip)).toBe(true)
    expect(shouldSkipPlaneMiniCardClick(skip)).toBe(false)
  })

  it('detects interactive targets', () => {
    const button = document.createElement('button')
    expect(isPlaneMiniInteractiveTarget(button)).toBe(true)
    expect(isPlaneMiniInteractiveTarget(document.createElement('span'))).toBe(false)
  })
})
