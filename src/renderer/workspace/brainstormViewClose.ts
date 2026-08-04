import type { BrainstormStatus } from '@shared/brainstormRoom'

/** Runner vivo: conviene Detener al cerrar (no incluye paused). */
export function isBrainstormStoppable(status: BrainstormStatus): boolean {
  return status === 'running' || status === 'idle'
}

export function canPauseBrainstorm(status: BrainstormStatus): boolean {
  return status === 'running'
}

export function canResumeBrainstorm(status: BrainstormStatus): boolean {
  return status === 'paused' || status === 'idle' || status === 'stopped'
}

/**
 * Al cerrar/desmontar la vista: detiene el runner si sigue activo.
 * `alreadyStopped` evita doble-stop cuando cierre + cleanup corren seguidos.
 */
export function stopBrainstormIfActive(options: {
  status: BrainstormStatus
  roomId: string
  alreadyStopped: boolean
  stop: (roomId: string) => void
}): boolean {
  if (options.alreadyStopped) return true
  if (!isBrainstormStoppable(options.status)) return false
  options.stop(options.roomId)
  return true
}
