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
  | 'generic'

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
