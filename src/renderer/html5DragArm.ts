/**
 * HTML5 `draggable={true}` en reposo hace que Chromium/Electron parpadee
 * pointer ↔ default en hover. Armar solo tras mousedown primario.
 * Ver [[cursor-flicker-draggable]].
 */

export type Html5DragArm = { current: boolean }

export function createHtml5DragArm(): Html5DragArm {
  return { current: false }
}

/** Activa `el.draggable` hasta mouseup (capture) o `disarmHtml5Drag`. */
export function armHtml5DragOnMouseDown(
  el: HTMLElement,
  arm: Html5DragArm,
  button: number = 0,
): void {
  // Solo primario; `undefined`/`0` cuentan como primario (jsdom/RTL a veces omite button).
  if (typeof button === 'number' && button !== 0) return
  arm.current = true
  el.draggable = true
  window.addEventListener(
    'mouseup',
    () => {
      arm.current = false
      el.draggable = false
    },
    { capture: true, once: true },
  )
}

export function disarmHtml5Drag(el: HTMLElement, arm: Html5DragArm): void {
  arm.current = false
  el.draggable = false
}

/** `true` si el drag puede continuar; si no, cancela el evento. */
export function allowArmedHtml5DragStart(
  el: HTMLElement,
  arm: Html5DragArm,
  preventDefault: () => void,
): boolean {
  if (arm.current) return true
  preventDefault()
  el.draggable = false
  return false
}
