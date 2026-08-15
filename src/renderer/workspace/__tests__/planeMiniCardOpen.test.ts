/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  isPlaneMiniInteractiveTarget,
  isPlaneMiniSmallControlTarget,
  isPlaneMiniThreadRowTarget,
  markPlaneMiniCardOpenedFromPointer,
  openPlaneMiniCardFromPointerDown,
  readPlaneMiniThreadIdFromTarget,
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

  it('isPlaneMiniSmallControlTarget excludes thread lanes but includes mini controls', () => {
    const threadRow = document.createElement('button')
    threadRow.className = 'plane-agent-thread-nodes__row'
    threadRow.dataset.threadId = 't1'
    expect(isPlaneMiniSmallControlTarget(threadRow)).toBe(false)
    expect(isPlaneMiniThreadRowTarget(threadRow)).toBe(true)
    expect(readPlaneMiniThreadIdFromTarget(threadRow)).toBe('t1')

    const action = document.createElement('button')
    action.className = 'plane-mini-face__action'
    expect(isPlaneMiniSmallControlTarget(action)).toBe(true)
    expect(isPlaneMiniThreadRowTarget(action)).toBe(false)

    const resultsDrag = document.createElement('button')
    resultsDrag.className = 'plane-mini-face__results-drag'
    expect(isPlaneMiniSmallControlTarget(resultsDrag)).toBe(true)

    const dragHandle = document.createElement('button')
    dragHandle.className = 'plane-mini-face__drag-handle'
    expect(isPlaneMiniSmallControlTarget(dragHandle)).toBe(true)

    expect(isPlaneMiniSmallControlTarget(document.createElement('span'))).toBe(false)
    expect(isPlaneMiniThreadRowTarget(document.createElement('span'))).toBe(false)
  })

  it('openPlaneMiniCardFromPointerDown skips thread rows', () => {
    const onOpen = vi.fn()
    const threadRow = document.createElement('button')
    threadRow.className = 'plane-agent-thread-nodes__row'
    threadRow.dataset.threadId = 't1'
    const event = {
      button: 0,
      target: threadRow,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    } as unknown as React.PointerEvent

    openPlaneMiniCardFromPointerDown(event, onOpen)

    expect(onOpen).not.toHaveBeenCalled()
  })
})
