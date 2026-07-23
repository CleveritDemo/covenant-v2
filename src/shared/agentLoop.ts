/** Marcador que el modelo emite para pedir el fin del loop autónomo. */
export const LOOP_DONE_MARKER = '[[LOOP_DONE]]'

/** Tope de seguridad para no dejar un loop infinito. */
export const MAX_AGENT_LOOP_ITERATIONS = 40

/** Pausa breve entre iteraciones para que la UI y el CLI se estabilicen. */
export const AGENT_LOOP_CONTINUE_DELAY_MS = 700

/** Opciones del modal: cada cuánto reiniciar la siguiente iteración. */
export const LOOP_INTERVAL_PRESETS = [
  { id: '1m', ms: 60_000 },
  { id: '10m', ms: 10 * 60_000 },
  { id: '30m', ms: 30 * 60_000 },
  { id: '1h', ms: 60 * 60_000 },
  { id: '3h', ms: 3 * 60 * 60_000 },
  { id: '6h', ms: 6 * 60 * 60_000 },
  { id: '12h', ms: 12 * 60 * 60_000 },
] as const

export type LoopIntervalPresetId = (typeof LOOP_INTERVAL_PRESETS)[number]['id']

export function loopIntervalPresetByMs(ms: number): LoopIntervalPresetId {
  const match = LOOP_INTERVAL_PRESETS.find(preset => preset.ms === ms)
  return match?.id ?? '1m'
}

export function formatLoopIntervalMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  if (ms % (60 * 60_000) === 0) {
    const hours = ms / (60 * 60_000)
    return hours === 1 ? '1 h' : `${hours} h`
  }
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000
    return minutes === 1 ? '1 min' : `${minutes} min`
  }
  if (ms % 1000 === 0) return `${ms / 1000} s`
  return `${ms} ms`
}

export function buildLoopPrompt(objective: string, _iteration = 1): string {
  // Misma interacción que un turno normal: el objetivo es el prompt del usuario.
  return objective.trim()
}

export function stripLoopDoneMarker(text: string): { text: string; done: boolean } {
  const done = text.includes(LOOP_DONE_MARKER)
  if (!done) return { text, done: false }
  return {
    done: true,
    text: text
      .split(LOOP_DONE_MARKER)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd(),
  }
}
