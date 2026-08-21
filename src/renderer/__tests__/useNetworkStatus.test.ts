/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { networkStatusFromOnLine, useNetworkStatus } from '../useNetworkStatus'

describe('networkStatusFromOnLine', () => {
  it.each([
    [false, 'offline'],
    [true, 'online'],
    [undefined, 'online'],
    [null, 'online'],
  ] as const)('mapea %s → %s', (onLine, expected) => {
    expect(networkStatusFromOnLine(onLine)).toBe(expected)
  })
})

describe('useNetworkStatus', () => {
  let originalOnLine: PropertyDescriptor | undefined

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(window.navigator, 'onLine', originalOnLine)
      originalOnLine = undefined
    }
  })

  it('arranca online y reacciona a eventos offline/online de window', () => {
    originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })

    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe('online')

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe('offline')

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe('online')
  })

  it('quita los listeners de online y offline al desmontar', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useNetworkStatus())

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('arranca offline cuando navigator.onLine es false antes del montaje', () => {
    originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })

    const { result } = renderHook(() => useNetworkStatus())
    expect(result.current).toBe('offline')
  })
})
