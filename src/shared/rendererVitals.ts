/**
 * Constantes vitales del renderer, tal y como viajan por `APP_RENDERER_VITALS`
 * hasta el anillo de `memory-history` en `crash-diagnostics.log`.
 *
 * Existe porque `app.getAppMetrics()` (lo único que main ve por su cuenta) mide
 * `workingSetSize`: el residente del proceso entero. Ante un OOM eso no
 * distingue heap de JS de DOM, de texturas o de buffers nativos, y esa
 * distinción es justo la que decide por dónde empezar a buscar. `heapPct` es la
 * señal directa: el renderer muere cuando el heap llega a su límite, no cuando
 * el RSS llega a una cifra bonita.
 */

/** Estado de la app en el momento de la muestra: el "qué estaba pasando". */
export interface RendererVitalsStats {
  tabs: number
  panes: number
  agentPanes: number
  /** Panes con un turno en curso. */
  busyPanes: number
  /** Carriles vivos (turnos de delegación en paralelo) sumados entre panes. */
  runningLanes: number
}

export interface RendererVitals extends RendererVitalsStats {
  /** Heap de JS en MB. Ausente si el runtime no expone `performance.memory`. */
  heapUsedMb?: number
  heapTotalMb?: number
  heapLimitMb?: number
  /** Porcentaje del límite de heap consumido: >90 es muerte inminente. */
  heapPct?: number
  /** Nodos del DOM: separa una fuga de árbol React de una de datos. */
  domNodes: number
}

/** Lo que expone `performance.memory` en Chromium (no está en el tipo estándar). */
export interface JsHeapReading {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

const BYTES_PER_MB = 1024 * 1024

function toMb(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MB)
}

/**
 * Arma la muestra. Puro y sin `window` para poder probarlo: el sampler del
 * renderer solo le pasa las lecturas crudas.
 */
export function buildRendererVitals(input: {
  heap?: JsHeapReading | null
  domNodes: number
  stats: RendererVitalsStats
}): RendererVitals {
  const { heap, domNodes, stats } = input
  const base: RendererVitals = { ...stats, domNodes }
  if (!heap) return base
  const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = heap
  // Un límite en 0 o ausente haría un porcentaje infinito o NaN en el log.
  const heapPct = jsHeapSizeLimit > 0
    ? Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100)
    : undefined
  return {
    ...base,
    heapUsedMb: toMb(usedJSHeapSize),
    heapTotalMb: toMb(totalJSHeapSize),
    heapLimitMb: toMb(jsHeapSizeLimit),
    ...(heapPct === undefined ? {} : { heapPct }),
  }
}

/**
 * Umbral a partir del cual la muestra se escribe a disco al momento, sin
 * esperar a que un crash vuelque el anillo. Si la app muere de una forma que no
 * dispara `render-process-gone` (OOM del sistema, kill -9), esta línea es lo
 * único que queda.
 */
export const RENDERER_HEAP_ALERT_PCT = 80

/** ¿Esta muestra merece una línea propia en el log ya mismo? */
export function shouldAlertOnHeap(vitals: RendererVitals): boolean {
  return (vitals.heapPct ?? 0) >= RENDERER_HEAP_ALERT_PCT
}
