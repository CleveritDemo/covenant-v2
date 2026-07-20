const SUPPRESS_ATTR = 'data-ia-suppress-mini-expand'

/** Bastante para absorber el pointer/click al cerrar un modal; no debe notarse al reabrir. */
const DEFAULT_SUPPRESS_MS = 320

let suppressUntilMs = 0
let clearTimer: number | null = null

/** Bloquea expandir minis del plano (click-through al cerrar modales). */
export function armMiniExpandSuppress(durationMs = DEFAULT_SUPPRESS_MS): void {
  suppressUntilMs = Math.max(suppressUntilMs, Date.now() + durationMs)
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute(SUPPRESS_ATTR, '1')
  }
  if (clearTimer != null) window.clearTimeout(clearTimer)
  const wait = Math.max(0, suppressUntilMs - Date.now())
  clearTimer = window.setTimeout(() => {
    clearTimer = null
    if (Date.now() < suppressUntilMs) return
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute(SUPPRESS_ATTR)
    }
  }, wait + 16)
}

export function isMiniExpandSuppressed(): boolean {
  if (Date.now() < suppressUntilMs) return true
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute(SUPPRESS_ATTR) === '1'
}

/** Mientras el modal de config está abierto (bloquea expand hasta onConfigClose). */
export function setMiniExpandLocked(locked: boolean): void {
  if (typeof document === 'undefined') return
  if (locked) {
    document.documentElement.setAttribute(SUPPRESS_ATTR, '1')
    return
  }
  armMiniExpandSuppress(DEFAULT_SUPPRESS_MS)
}
