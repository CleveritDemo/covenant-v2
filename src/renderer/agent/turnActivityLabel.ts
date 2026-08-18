export type TurnPhase = 'starting' | 'context' | 'thinking' | 'tool' | 'writing'

export interface TurnActivityState {
  phase: TurnPhase
  toolLabel?: string
  contextCount?: number
  toolCount: number
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Etiqueta de fase del turno activo. Nunca devuelve cadena vacía. */
export function turnActivityLabel(state: TurnActivityState, t: Translate): string {
  if (state.phase === 'starting') return t('agentPane.phaseStarting')
  if (state.phase === 'context') {
    return t('agentPane.contextLoading', { n: state.contextCount ?? 0 })
  }
  if (state.phase === 'thinking') return t('agentPane.phaseThinking')
  if (state.phase === 'writing') return t('agentPane.phaseWriting')
  const label = t('agentPane.activity', { tool: state.toolLabel ?? '' })
  if (state.toolCount > 1) {
    return t('agentPane.activitySteps', { label, n: state.toolCount })
  }
  return label
}

/** Clave de animación: fase + herramienta, sin el reloj. */
export function turnActivityKey(state: TurnActivityState): string {
  return `${state.phase}:${state.toolLabel ?? ''}`
}

/** `m:ss` hasta 59:59; `h:mm:ss` desde 1 h. Negativos y NaN → `0:00`. */
export function formatElapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}
