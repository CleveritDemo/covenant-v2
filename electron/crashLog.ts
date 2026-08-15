/**
 * Bitácora de diagnóstico de fallos en userData (`crash-diagnostics.log`).
 *
 * Vive en su propio módulo — y no en `main.ts` — porque lo escriben también los
 * módulos que manejan EventEmitters cuyo `'error'` sin listener mataría el
 * proceso principal entero (watchers de fs, procesos hijo).
 */

import { appendFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/** Tope del log antes de rotar a `.1` (el anterior `.1` se pierde). */
export const CRASH_LOG_MAX_BYTES = 1_000_000

function crashLogPath(): string {
  return join(app.getPath('userData'), 'crash-diagnostics.log')
}

/** Rota cuando el log pasa de `CRASH_LOG_MAX_BYTES` para que no crezca sin fin. */
function rotateCrashLogIfNeeded(path: string): void {
  try {
    if (statSync(path).size < CRASH_LOG_MAX_BYTES) return
    renameSync(path, `${path}.1`)
  } catch { /* no existe todavía, o no se puede rotar: da igual */ }
}

/** Nunca lanza: un fallo escribiendo el log de fallos no puede tumbar la app. */
export function appendCrashDiagnostics(label: string, details: unknown): void {
  console.error(`[crash-diagnostics] ${label}`, details)
  try {
    const path = crashLogPath()
    rotateCrashLogIfNeeded(path)
    const line = `${new Date().toISOString()} ${label} ${JSON.stringify(details)}\n`
    appendFileSync(path, line, 'utf-8')
  } catch { /* ignore */ }
}

/** Normaliza cualquier valor lanzado para dejarlo en el log. */
export function describeError(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    return { message: value.message || value.name, stack: value.stack }
  }
  return { message: typeof value === 'string' ? value : String(value) }
}
