import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLaneDeltaThrottler } from '../laneDeltaThrottle'

describe('createLaneDeltaThrottler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('junta los deltas de la ventana en una sola aplicación', () => {
    const applied: Array<[string, string]> = []
    const throttler = createLaneDeltaThrottler((id, text) => applied.push([id, text]), 200)

    throttler.append('t1', 'hola')
    throttler.append('t1', ' ')
    throttler.append('t1', 'mundo')
    expect(applied).toEqual([])

    vi.advanceTimersByTime(200)
    expect(applied).toEqual([['t1', 'hola mundo']])
  })

  it('no mezcla el texto de carriles distintos', () => {
    const applied: Array<[string, string]> = []
    const throttler = createLaneDeltaThrottler((id, text) => applied.push([id, text]), 200)

    throttler.append('t1', 'uno')
    throttler.append('t2', 'dos')
    vi.advanceTimersByTime(200)

    expect(applied.sort()).toEqual([['t1', 'uno'], ['t2', 'dos']])
  })

  it('vacía solo el carril pedido', () => {
    const applied: Array<[string, string]> = []
    const throttler = createLaneDeltaThrottler((id, text) => applied.push([id, text]), 200)

    throttler.append('t1', 'uno')
    throttler.append('t2', 'dos')
    throttler.flush('t1')

    expect(applied).toEqual([['t1', 'uno']])
  })

  it('un flush sin pendientes no aplica nada', () => {
    const apply = vi.fn()
    const throttler = createLaneDeltaThrottler(apply, 200)

    throttler.flush('t1')
    throttler.flush()

    expect(apply).not.toHaveBeenCalled()
  })

  it('no reaplica lo ya vaciado cuando vence el timer', () => {
    const applied: Array<[string, string]> = []
    const throttler = createLaneDeltaThrottler((id, text) => applied.push([id, text]), 200)

    throttler.append('t1', 'uno')
    throttler.flush('t1')
    vi.advanceTimersByTime(500)

    expect(applied).toEqual([['t1', 'uno']])
  })

  it('reabre la ventana tras un flush', () => {
    const applied: Array<[string, string]> = []
    const throttler = createLaneDeltaThrottler((id, text) => applied.push([id, text]), 200)

    throttler.append('t1', 'uno')
    throttler.flush('t1')
    throttler.append('t1', 'dos')
    vi.advanceTimersByTime(200)

    expect(applied).toEqual([['t1', 'uno'], ['t1', 'dos']])
  })

  it('dispose aplica lo pendiente de todos los carriles', () => {
    const applied: Array<[string, string]> = []
    const throttler = createLaneDeltaThrottler((id, text) => applied.push([id, text]), 200)

    throttler.append('t1', 'uno')
    throttler.append('t2', 'dos')
    throttler.dispose()

    expect(applied.sort()).toEqual([['t1', 'uno'], ['t2', 'dos']])
    vi.advanceTimersByTime(500)
    expect(applied).toHaveLength(2)
  })

  it('ignora texto vacío', () => {
    const apply = vi.fn()
    const throttler = createLaneDeltaThrottler(apply, 200)

    throttler.append('t1', '')
    vi.advanceTimersByTime(500)

    expect(apply).not.toHaveBeenCalled()
  })
})
