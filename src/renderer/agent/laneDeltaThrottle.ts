/**
 * Acumulador de deltas de streaming por carril.
 *
 * El camino visible ya tenía el suyo (`assistantDeltaThrottle`), pero el de los
 * carriles aplicaba cada delta al llegar, y aplicar un delta no es barato:
 * clona el `Map` de carriles, clona la lista de mensajes y sube `lanesVersion`,
 * o sea un re-render del pane por token. Con varios carriles vivos eso llenaba
 * el heap del renderer en minutos.
 *
 * Es por `threadId` y no uno global porque los carriles corren en paralelo:
 * mezclar su texto en un único buffer pondría la respuesta de un agente dentro
 * del mensaje de otro.
 */

import { ASSISTANT_DELTA_THROTTLE_MS } from './assistantDeltaThrottle'

export interface LaneDeltaThrottler {
  append: (threadId: string, text: string) => void
  /** Sin `threadId`, vacía todos los carriles. */
  flush: (threadId?: string) => void
  dispose: () => void
}

export function createLaneDeltaThrottler(
  applyBatch: (threadId: string, text: string) => void,
  throttleMs: number = ASSISTANT_DELTA_THROTTLE_MS,
): LaneDeltaThrottler {
  const pendingText = new Map<string, string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const clearTimer = (threadId: string): void => {
    const timer = timers.get(threadId)
    if (timer == null) return
    clearTimeout(timer)
    timers.delete(threadId)
  }

  const flushLane = (threadId: string): void => {
    clearTimer(threadId)
    const text = pendingText.get(threadId)
    pendingText.delete(threadId)
    if (!text) return
    applyBatch(threadId, text)
  }

  const flush = (threadId?: string): void => {
    if (threadId !== undefined) {
      flushLane(threadId)
      return
    }
    for (const id of [...pendingText.keys()]) flushLane(id)
  }

  const append = (threadId: string, text: string): void => {
    if (!text) return
    pendingText.set(threadId, (pendingText.get(threadId) ?? '') + text)
    if (timers.has(threadId)) return
    timers.set(threadId, setTimeout(() => {
      timers.delete(threadId)
      flushLane(threadId)
    }, throttleMs))
  }

  const dispose = (): void => {
    // Vaciar y no descartar: el texto pendiente ya llegó del CLI y tirarlo
    // dejaría el último trozo de la respuesta fuera del transcripto.
    flush()
    for (const id of [...timers.keys()]) clearTimer(id)
  }

  return { append, flush, dispose }
}
