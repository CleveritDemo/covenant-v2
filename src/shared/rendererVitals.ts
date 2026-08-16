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
  /** `performance` avisa de que el heap viene cuantizado y puede estar viejo. */
  heapSource?: HeapSource
  /**
   * PartitionAlloc de Blink en MB. Es lo que separa "se llenó el heap de JS" de
   * "creció el DOM / los strings / los buffers", que en el RSS se ven igual.
   */
  blinkUsedMb?: number
  blinkTotalMb?: number
  /** Nodos del DOM: separa una fuga de árbol React de una de datos. */
  domNodes: number
}

/** Lo que expone `performance.memory` en Chromium (no está en el tipo estándar). */
export interface JsHeapReading {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

/**
 * Lectura del `process` de Electron en el preload, en KB (así los da Electron).
 *
 * Es la fuente buena y `performance.memory` el respaldo: Chromium cuantiza y
 * cachea `performance.memory` durante ~30 min, así que en un crash por OOM
 * repite el mismo valor viejo muestra tras muestra y se lee como "heap sano"
 * justo cuando el heap es el que está matando al proceso.
 */
export interface ProcessMemoryReading {
  /** `process.getHeapStatistics()`: el heap de V8 de verdad. */
  heapUsedKb: number
  heapTotalKb: number
  heapLimitKb: number
  /** `process.getBlinkMemoryInfo()`: PartitionAlloc (DOM, strings, buffers). */
  blinkAllocatedKb?: number
  blinkTotalKb?: number
}

/** De dónde salió el heap de la muestra; `performance` es el dato degradado. */
export type HeapSource = 'process' | 'performance'

const BYTES_PER_MB = 1024 * 1024
const KB_PER_MB = 1024

function toMb(bytes: number): number {
  return Math.round(bytes / BYTES_PER_MB)
}

function kbToMb(kb: number): number {
  return Math.round(kb / KB_PER_MB)
}

/** Un límite en 0 o ausente haría un porcentaje infinito o NaN en el log. */
function heapPctOf(used: number, limit: number): number | undefined {
  return limit > 0 ? Math.round((used / limit) * 100) : undefined
}

function fromProcessMemory(memory: ProcessMemoryReading): Partial<RendererVitals> {
  const heapPct = heapPctOf(memory.heapUsedKb, memory.heapLimitKb)
  return {
    heapUsedMb: kbToMb(memory.heapUsedKb),
    heapTotalMb: kbToMb(memory.heapTotalKb),
    heapLimitMb: kbToMb(memory.heapLimitKb),
    ...(heapPct === undefined ? {} : { heapPct }),
    heapSource: 'process',
    ...(memory.blinkAllocatedKb === undefined
      ? {}
      : { blinkUsedMb: kbToMb(memory.blinkAllocatedKb) }),
    ...(memory.blinkTotalKb === undefined
      ? {}
      : { blinkTotalMb: kbToMb(memory.blinkTotalKb) }),
  }
}

function fromPerformanceMemory(heap: JsHeapReading): Partial<RendererVitals> {
  const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = heap
  const heapPct = heapPctOf(usedJSHeapSize, jsHeapSizeLimit)
  return {
    heapUsedMb: toMb(usedJSHeapSize),
    heapTotalMb: toMb(totalJSHeapSize),
    heapLimitMb: toMb(jsHeapSizeLimit),
    ...(heapPct === undefined ? {} : { heapPct }),
    heapSource: 'performance',
  }
}

/**
 * Arma la muestra. Puro y sin `window` para poder probarlo: el sampler del
 * renderer solo le pasa las lecturas crudas.
 *
 * `processMemory` gana siempre que exista: `performance.memory` solo entra si
 * el preload no pudo leer el `process` de Electron, y entonces queda marcado
 * como tal en `heapSource` para que nadie lea ese heap como si fuera fresco.
 */
export function buildRendererVitals(input: {
  processMemory?: ProcessMemoryReading | null
  heap?: JsHeapReading | null
  domNodes: number
  stats: RendererVitalsStats
}): RendererVitals {
  const { processMemory, heap, domNodes, stats } = input
  const base: RendererVitals = { ...stats, domNodes }
  if (processMemory) return { ...base, ...fromProcessMemory(processMemory) }
  if (heap) return { ...base, ...fromPerformanceMemory(heap) }
  return base
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
