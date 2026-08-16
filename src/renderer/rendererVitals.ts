/**
 * Muestreo periódico de las constantes vitales del renderer hacia main.
 *
 * Main ya muestrea memoria por su cuenta, pero desde fuera solo ve el residente
 * del proceso. Lo que distingue "se llenó el heap de JS" de "explotó el DOM" o
 * de "creció algo nativo" solo se puede leer desde dentro del renderer.
 */

import {
  buildRendererVitals,
  type JsHeapReading,
  type RendererVitalsStats,
} from '@shared/rendererVitals'
import type { TabSession } from '@shared/tabSession'

/** Mismo ritmo que el anillo de `memory-history` en main: una vitals por punto. */
export const VITALS_SAMPLE_INTERVAL_MS = 20_000

const EMPTY_STATS: RendererVitalsStats = {
  tabs: 0,
  panes: 0,
  agentPanes: 0,
  busyPanes: 0,
  runningLanes: 0,
}

/**
 * Cuenta el estado de la app para la muestra. Puro: App le pasa lo que ya tiene
 * en refs, sin tocar el árbol de React.
 */
export function collectRendererVitalsStats(
  tabs: readonly TabSession[],
  busyPanes: ReadonlySet<string>,
  planeStatus: Readonly<Record<string, { runningThreadIds?: readonly string[] }>>,
): RendererVitalsStats {
  let panes = 0
  let agentPanes = 0
  for (const tab of tabs) {
    panes += tab.paneIds?.length ?? 0
    agentPanes += Object.keys(tab.agentByPane ?? {}).length
  }
  let runningLanes = 0
  for (const status of Object.values(planeStatus)) {
    runningLanes += status?.runningThreadIds?.length ?? 0
  }
  return {
    tabs: tabs.length,
    panes,
    agentPanes,
    busyPanes: busyPanes.size,
    runningLanes,
  }
}

let statsProvider: (() => RendererVitalsStats) | null = null

/**
 * App registra aquí de dónde salen los contadores. Es un provider y no un
 * `send` por render porque el muestreo lo marca el reloj, no el árbol de React:
 * publicar desde el render metería trabajo en el camino caliente del plano.
 */
export function setRendererVitalsStatsProvider(
  provider: (() => RendererVitalsStats) | null,
): void {
  statsProvider = provider
}

/** `performance.memory` es de Chromium y no está en los tipos del DOM. */
function readHeap(): JsHeapReading | null {
  const memory = (performance as Performance & { memory?: JsHeapReading }).memory
  if (!memory || typeof memory.jsHeapSizeLimit !== 'number') return null
  return {
    usedJSHeapSize: memory.usedJSHeapSize,
    totalJSHeapSize: memory.totalJSHeapSize,
    jsHeapSizeLimit: memory.jsHeapSizeLimit,
  }
}

function readStats(): RendererVitalsStats {
  try {
    return statsProvider?.() ?? EMPTY_STATS
  } catch {
    // Un fallo contando no puede impedir que se publique el heap, que es el
    // dato que de verdad importa ante un OOM.
    return EMPTY_STATS
  }
}

/** Toma y envía una muestra. Nunca lanza. */
export function sampleAndReportVitals(): void {
  try {
    const vitals = buildRendererVitals({
      heap: readHeap(),
      domNodes: document.getElementsByTagName('*').length,
      stats: readStats(),
    })
    window.api.reportRendererVitals(vitals)
  } catch {
    /* preload no disponible o documento a medio morir: no hay nada que hacer */
  }
}

let installed = false

/** Arranca el muestreo. Idempotente. */
export function installRendererVitals(): void {
  if (installed) return
  installed = true
  // Una muestra temprana da la línea base del arranque; sin ella el primer
  // punto del histórico llega 20 s tarde.
  sampleAndReportVitals()
  setInterval(sampleAndReportVitals, VITALS_SAMPLE_INTERVAL_MS)
}
