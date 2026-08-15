/**
 * Política de recuperación cuando el proceso renderer desaparece
 * (`webContents.on('render-process-gone')`).
 *
 * Sin recuperación la ventana se queda pintada con el `backgroundColor` de
 * `BrowserWindow` (oscuro) para siempre: el usuario ve "la app en negro" y no
 * hay forma de volver sin reiniciar. Recargar es seguro porque el renderer no
 * guarda estado propio: `session.json` lo escribe main.
 *
 * Lógica pura para poder testearla sin Electron; el driver está en
 * `electron/main.ts`.
 */

/** Recargas permitidas dentro de `RENDERER_RELOAD_WINDOW_MS`. */
export const RENDERER_RELOAD_MAX_ATTEMPTS = 3

/** Ventana deslizante para contar recargas (ms). */
export const RENDERER_RELOAD_WINDOW_MS = 60_000

/**
 * Único motivo que no es un fallo: el renderer terminó porque se lo pedimos
 * (cierre de ventana). `killed` sí se recarga — es lo que reporta Electron
 * cuando macOS mata el renderer por presión de memoria — salvo que estemos
 * saliendo, y de eso se encarga `quitting`.
 */
export const CLEAN_RENDER_EXIT_REASON = 'clean-exit'

export type RendererCrashAction = 'ignore' | 'reload' | 'give-up'

export interface RendererCrashDecision {
  action: RendererCrashAction
  /** Intentos vigentes tras la decisión; el llamador guarda esto. */
  attemptsMs: number[]
}

export interface RendererCrashInput {
  /** `details.reason` de `render-process-gone`. */
  reason: string
  /** La app está cerrándose: el renderer muere por diseño. */
  quitting: boolean
  /** Timestamps (ms) de las recargas previas de esta ventana. */
  attemptsMs: readonly number[]
  now: number
}

/**
 * `give-up` en vez de recargar en bucle: si el crash es determinista (una
 * sesión corrupta, por ejemplo) recargar sin tope deja la app parpadeando y
 * quema la batería. Ahí es mejor avisar y que el usuario reinicie.
 */
export function decideRendererCrashRecovery(input: RendererCrashInput): RendererCrashDecision {
  const recent = input.attemptsMs.filter(ts => input.now - ts < RENDERER_RELOAD_WINDOW_MS)
  if (input.quitting || input.reason === CLEAN_RENDER_EXIT_REASON) {
    return { action: 'ignore', attemptsMs: recent }
  }
  if (recent.length >= RENDERER_RELOAD_MAX_ATTEMPTS) {
    return { action: 'give-up', attemptsMs: recent }
  }
  return { action: 'reload', attemptsMs: [...recent, input.now] }
}
