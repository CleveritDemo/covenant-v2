/**
 * Error no capturado del renderer, tal y como viaja por `APP_RENDERER_ERROR`
 * hasta `crash-diagnostics.log`.
 */
export interface RendererErrorReport {
  /** De dónde salió: qué handler lo capturó. */
  source: 'error-boundary' | 'window-onerror' | 'unhandled-rejection' | 'boot'
  message: string
  stack?: string
  /** Pila de componentes de React (solo en `error-boundary`). */
  componentStack?: string
  /** `location.href` del renderer cuando ocurrió. */
  url?: string
}

/** Normaliza cualquier valor lanzado (throw de un string, de un objeto, …). */
export function describeThrownValue(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    return { message: value.message || value.name, stack: value.stack }
  }
  if (typeof value === 'string') return { message: value }
  try {
    return { message: JSON.stringify(value) ?? String(value) }
  } catch {
    return { message: String(value) }
  }
}
