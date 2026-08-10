/**
 * Clasificación de errores de dictado nativo (IPC) para i18n en el renderer.
 * El runtime vive en electron/dictationRuntime.ts.
 */

export type DictationUiErrorKind =
  | 'unsupported'
  | 'permission'
  | 'electronUnavailable'
  | 'generic'

/** Clasifica códigos IPC/legacy (p. ej. `network` de Web Speech) para i18n. */
export function classifyDictationError(code: string): DictationUiErrorKind {
  const normalized = code.trim().toLowerCase()
  if (normalized === 'network') return 'electronUnavailable'
  if (
    normalized === 'unsupported'
    || normalized === 'start-failed'
    || normalized === 'helper-missing'
  ) {
    return 'unsupported'
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
  return (
    normalized === 'aborted'
    || normalized === 'no-speech'
    || normalized === 'not-running'
  )
}
