import type { MutableRefObject, PointerEvent as ReactPointerEvent } from 'react'

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"]'

export function isPlaneMiniInteractiveTarget(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest?.(INTERACTIVE_SELECTOR))
}

const THREAD_ROW_SELECTOR = '.plane-agent-thread-nodes__row'

const SMALL_CONTROL_SELECTOR = '.plane-mini-face__action, .plane-mini-face__controls-btn, .plane-mini-face__controls-rail, .plane-mini-face__results-drag, .plane-mini-face__drag-handle, .plane-mini-actions__btn, .pane-window__mini-corner, input, select, textarea, a[href]'

/** Fila de hilo activo en la mini card (abre ese hilo, no la card entera). */
export function isPlaneMiniThreadRowTarget(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest?.(THREAD_ROW_SELECTOR))
}

export function readPlaneMiniThreadIdFromTarget(target: EventTarget | null): string | null {
  const row = (target as HTMLElement | null)?.closest?.(THREAD_ROW_SELECTOR) as HTMLElement | null
  const threadId = row?.dataset?.threadId?.trim()
  return threadId || null
}

/** Controles pequeños del mini: config, drag, results, etc.
 *  Los carriles de hilo (.plane-agent-thread-nodes__row) quedan fuera a propósito:
 *  con el agente busy ocupan toda la card y deben abrir ese hilo, no el chat genérico. */
export function isPlaneMiniSmallControlTarget(target: EventTarget | null): boolean {
  return Boolean((target as HTMLElement | null)?.closest?.(SMALL_CONTROL_SELECTOR))
}

/**
 * Abre la mini card en pointerdown (sin esperar click sintético).
 * El cálculo de hilo en App corre después, async — no bloquea el gesto.
 */
export function openPlaneMiniCardFromPointerDown(
  event: ReactPointerEvent,
  onOpen: () => void,
): void {
  if (event.button !== 0) return
  if (isPlaneMiniThreadRowTarget(event.target)) return
  if (isPlaneMiniSmallControlTarget(event.target)) return
  event.preventDefault()
  event.stopPropagation()
  onOpen()
}

/** Evita doble apertura pointerdown + click sintético residual. */
export function shouldSkipPlaneMiniCardClick(
  skipClickRef: MutableRefObject<boolean>,
): boolean {
  if (!skipClickRef.current) return false
  skipClickRef.current = false
  return true
}

export function markPlaneMiniCardOpenedFromPointer(skipClickRef: MutableRefObject<boolean>): void {
  skipClickRef.current = true
}
