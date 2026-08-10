/**
 * Clasificación de errores de dictado nativo (IPC) para i18n en el renderer.
 * El runtime vive en electron/dictationRuntime.ts.
 */

export type DictationUiErrorKind =
  | 'unsupported'
  | 'helperMissing'
  | 'startFailed'
  | 'permission'
  | 'electronUnavailable'
  | 'noSpeech'
  | 'noAudio'
  | 'tooShort'
  | 'generic'

/**
 * Bajo este umbral el tap de audio no alcanza a recibir buffers: el helper
 * reporta `peak = 0` y eso llegaba al usuario como "no hay señal de micrófono",
 * culpando al dispositivo cuando en realidad fue un clic en vez de mantener
 * pulsado. El helper emite `level` cada ~40 ms, así que 400 ms son ~10 muestras.
 */
export const MIN_DICTATION_MS = 400

/**
 * Reclasifica el resultado vacío de una sesión demasiado corta. Solo aplica a
 * los dos códigos que significan "no hubo nada que transcribir": el resto son
 * fallos reales y se respetan tal cual.
 */
export function dictationStopErrorCode(code: string, elapsedMs: number): string {
  const normalized = code.trim().toLowerCase()
  if (normalized !== 'no-audio' && normalized !== 'no-speech') return code
  return elapsedMs < MIN_DICTATION_MS ? 'too-short' : code
}

export interface DictationPermissionResult {
  ok: boolean
  error?: 'unsupported' | 'permission-denied'
  message?: string
}

/** Clasifica códigos IPC/legacy (p. ej. `network` de Web Speech) para i18n. */
export function classifyDictationError(code: string): DictationUiErrorKind {
  const normalized = code.trim().toLowerCase()
  if (normalized === 'network') return 'electronUnavailable'
  if (normalized === 'no-speech') return 'noSpeech'
  if (normalized === 'no-audio') return 'noAudio'
  if (normalized === 'too-short') return 'tooShort'
  if (normalized === 'unsupported') return 'unsupported'
  if (normalized === 'helper-missing') return 'helperMissing'
  if (
    normalized === 'start-failed'
    || normalized === 'audio-failed'
  ) {
    return 'startFailed'
  }
  if (
    normalized === 'permission'
    || normalized === 'permission-denied'
    || normalized === 'not-allowed'
    || normalized === 'service-not-allowed'
  ) {
    return 'permission'
  }
  return 'generic'
}

export function isIgnorableDictationError(code: string): boolean {
  const normalized = code.trim().toLowerCase()
  return normalized === 'aborted' || normalized === 'not-running'
}
