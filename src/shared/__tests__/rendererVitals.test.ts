import { describe, expect, it } from 'vitest'
import {
  buildRendererVitals,
  shouldAlertOnHeap,
  RENDERER_HEAP_ALERT_PCT,
  type RendererVitalsStats,
} from '../rendererVitals'

const stats: RendererVitalsStats = {
  tabs: 2,
  panes: 5,
  agentPanes: 4,
  busyPanes: 3,
  runningLanes: 7,
}

const MB = 1024 * 1024

describe('buildRendererVitals', () => {
  it('convierte el heap a MB y calcula el porcentaje del límite', () => {
    const vitals = buildRendererVitals({
      heap: {
        usedJSHeapSize: 2048 * MB,
        totalJSHeapSize: 3072 * MB,
        jsHeapSizeLimit: 4096 * MB,
      },
      domNodes: 12_000,
      stats,
    })
    expect(vitals.heapUsedMb).toBe(2048)
    expect(vitals.heapTotalMb).toBe(3072)
    expect(vitals.heapLimitMb).toBe(4096)
    expect(vitals.heapPct).toBe(50)
  })

  it('conserva los contadores de estado y los nodos del DOM', () => {
    const vitals = buildRendererVitals({ heap: null, domNodes: 999, stats })
    expect(vitals).toMatchObject({ ...stats, domNodes: 999 })
  })

  it('omite los campos de heap cuando el runtime no lo expone', () => {
    const vitals = buildRendererVitals({ heap: null, domNodes: 0, stats })
    expect(vitals.heapUsedMb).toBeUndefined()
    expect(vitals.heapPct).toBeUndefined()
  })

  it('no produce NaN ni Infinity con un límite de heap en 0', () => {
    const vitals = buildRendererVitals({
      heap: { usedJSHeapSize: 10 * MB, totalJSHeapSize: 10 * MB, jsHeapSizeLimit: 0 },
      domNodes: 0,
      stats,
    })
    expect(vitals.heapPct).toBeUndefined()
    expect(vitals.heapLimitMb).toBe(0)
  })
})

describe('shouldAlertOnHeap', () => {
  const withPct = (heapPct: number | undefined) => ({ ...stats, domNodes: 0, heapPct })

  it('alerta al alcanzar el umbral', () => {
    expect(shouldAlertOnHeap(withPct(RENDERER_HEAP_ALERT_PCT))).toBe(true)
    expect(shouldAlertOnHeap(withPct(95))).toBe(true)
  })

  it('no alerta por debajo del umbral', () => {
    expect(shouldAlertOnHeap(withPct(RENDERER_HEAP_ALERT_PCT - 1))).toBe(false)
    expect(shouldAlertOnHeap(withPct(0))).toBe(false)
  })

  it('no alerta si no hay lectura de heap', () => {
    expect(shouldAlertOnHeap(withPct(undefined))).toBe(false)
  })
})
