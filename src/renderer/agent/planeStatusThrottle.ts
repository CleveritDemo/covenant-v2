/** Intervalo por defecto: ~6–7 updates/s al streamear mensajes al plano. */
export const PLANE_STATUS_THROTTLE_MS = 500

export interface PlaneStatusThrottleOptions<T> {
  /** Señal de control: si cambia, publica al instante (busy, loops, etc.). */
  controlKey: string
  /** Payload a publicar (siempre el más reciente). */
  value: T
  publish: (value: T) => void
  throttleMs?: number
}

/**
 * Publica de inmediato si `controlKey` cambió; si no, como máximo cada `throttleMs`
 * (trailing). Devuelve cleanup que flushea el pendiente.
 */
export function createPlaneStatusThrottler<T>(): {
  schedule: (options: PlaneStatusThrottleOptions<T>) => void
  flush: () => void
  dispose: () => void
} {
  let timer: number | null = null
  let pending: T | null = null
  let lastControlKey = ''
  let lastPublishAt = 0
  let publishFn: ((value: T) => void) | null = null

  const clearTimer = (): void => {
    if (timer == null) return
    clearTimeout(timer)
    timer = null
  }

  const emit = (value: T): void => {
    pending = null
    clearTimer()
    lastPublishAt = Date.now()
    publishFn?.(value)
  }

  const flush = (): void => {
    if (pending == null) {
      clearTimer()
      return
    }
    emit(pending)
  }

  const schedule = (options: PlaneStatusThrottleOptions<T>): void => {
    const { controlKey, value, publish, throttleMs = PLANE_STATUS_THROTTLE_MS } = options
    publishFn = publish
    pending = value

    const controlChanged = controlKey !== lastControlKey
    lastControlKey = controlKey

    if (controlChanged || lastPublishAt === 0) {
      emit(value)
      return
    }

    const elapsed = Date.now() - lastPublishAt
    if (elapsed >= throttleMs) {
      emit(value)
      return
    }

    if (timer != null) return
    timer = setTimeout(() => {
      timer = null
      flush()
    }, throttleMs - elapsed) as unknown as number
  }

  const dispose = (): void => {
    flush()
    publishFn = null
  }

  return { schedule, flush, dispose }
}
