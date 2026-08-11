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

/** La sala sigue viva al minimizar: el indicador del plano se muestra con esto. */
export function isBrainstormLive(status: BrainstormStatus): boolean {
  return status === 'running' || status === 'idle' || status === 'paused'
}
