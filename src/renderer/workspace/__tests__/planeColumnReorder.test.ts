/**
 * @vitest-environment jsdom
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  HANDLE_DRAG_THRESHOLD_PX,
  shouldCommitReorder,
  usePlaneColumnReorder,
  type PlaneColumnSlot,
} from '../planeColumnReorder'

afterEach(() => {
  cleanup()
})

function fakeReactPointer(
  target: HTMLElement,
  clientX: number,
  clientY: number,
  pointerId = 1,
): React.PointerEvent {
  return {
    button: 0,
    pointerId,
    clientX,
    clientY,
    currentTarget: target,
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.PointerEvent
}

function dispatchWindowPointer(
  type: 'pointermove' | 'pointerup' | 'pointercancel',
  clientX: number,
  clientY: number,
  pointerId = 1,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
  })
  window.dispatchEvent(event)
}

const ORDERED = ['a', 'b', 'c'] as const

const SLOTS: Record<string, PlaneColumnSlot> = {
  a: { x: 0, y: 0, width: 200, height: 100 },
  b: { x: 0, y: 110, width: 200, height: 100 },
  c: { x: 0, y: 220, width: 200, height: 100 },
}

describe('shouldCommitReorder', () => {
  it('returns true only when preview differs from baseline', () => {
    expect(shouldCommitReorder(['a', 'b'], ['a', 'b'])).toBe(false)
    expect(shouldCommitReorder(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(shouldCommitReorder(['a', 'b'], null)).toBe(false)
    expect(shouldCommitReorder(null, ['a', 'b'])).toBe(false)
  })
})

describe('usePlaneColumnReorder handle dragOnMove', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('A) click without moving past threshold does not commit', () => {
    const onCommit = vi.fn()
    const onActivate = vi.fn()
    const handle = document.createElement('button')
    document.body.appendChild(handle)

    const { result } = renderHook(() => usePlaneColumnReorder({
      enabled: true,
      kind: 'agent',
      orderedIds: [...ORDERED],
      slots: SLOTS,
      onCommit,
      onActivate,
    }))

    act(() => {
      result.current.onHandlePointerDown('a', fakeReactPointer(handle, 10, 40))
    })
    act(() => {
      dispatchWindowPointer('pointermove', 10, 40 + HANDLE_DRAG_THRESHOLD_PX)
      dispatchWindowPointer('pointerup', 10, 40 + HANDLE_DRAG_THRESHOLD_PX)
    })

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.draggingId).toBeNull()
    expect(result.current.editing).toBe(false)
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('B) move past threshold then pointerup commits reordered ids once', () => {
    const onCommit = vi.fn()
    const handle = document.createElement('button')
    document.body.appendChild(handle)

    const { result } = renderHook(() => usePlaneColumnReorder({
      enabled: true,
      kind: 'agent',
      orderedIds: [...ORDERED],
      slots: SLOTS,
      onCommit,
      onActivate: vi.fn(),
    }))

    act(() => {
      result.current.onHandlePointerDown('a', fakeReactPointer(handle, 10, 50))
    })
    // Mover hacia el centro de b/c para insertar a entre b y c → [b, a, c]
    act(() => {
      dispatchWindowPointer('pointermove', 10, 50 + 160)
    })
    expect(result.current.draggingId).toBe('a')

    act(() => {
      dispatchWindowPointer('pointerup', 10, 50 + 160)
    })

    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(['b', 'a', 'c'])
    expect(result.current.draggingId).toBeNull()
    expect(result.current.editing).toBe(false)
    expect(result.current.previewIds).toBeNull()
  })

  it('C) exports card long-press entry point without throwing', () => {
    const { result } = renderHook(() => usePlaneColumnReorder({
      enabled: true,
      kind: 'terminal',
      orderedIds: [...ORDERED],
      slots: SLOTS,
      onCommit: vi.fn(),
      onActivate: vi.fn(),
    }))
    expect(typeof result.current.onCardPointerDown).toBe('function')
    expect(typeof result.current.onHandlePointerDown).toBe('function')
    expect(typeof result.current.cancel).toBe('function')
  })
})
