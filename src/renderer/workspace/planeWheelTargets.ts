/**
 * ¿El cursor está sobre algo que ya sabe hacer scroll por sí mismo?
 *
 * `PlaneMap` escucha `wheel` en `window` **en fase de captura**, así que ve la
 * rueda antes que cualquier overlay y mueve las columnas del plano. Eso está
 * bien sobre el lienzo y mal sobre un desplegable: el usuario ve moverse los
 * agentes del fondo en vez de la lista que tiene delante, y ningún
 * `overscroll-behavior` lo evita — el CSS no detiene un listener de captura.
 *
 * Antes esto se resolvía con una lista blanca de selectores
 * (`.terminal-modal-root, .pane-window--full`). Funciona hasta que alguien
 * añade un overlay nuevo y no lo apunta ahí, que es exactamente cómo apareció
 * este bug con el popover del pool de contextos. La regla general —«si debajo
 * del cursor hay algo con scroll nativo real, es suyo»— no hay que mantenerla.
 */
export function hasNativeScrollAncestor(
  target: Element | null,
  /** Raíz del plano: por encima de ella ya no se busca. */
  boundary: Element,
): boolean {
  for (let node = target; node && node !== boundary; node = node.parentElement) {
    const style = window.getComputedStyle(node)
    const scrollsY = style.overflowY === 'auto' || style.overflowY === 'scroll'
    // `scrollHeight > clientHeight` es lo que separa «puede scrollear» de
    // «declara overflow pero cabe entero»: sin esa comprobación, un contenedor
    // con `overflow-y: auto` y poco contenido secuestraría la rueda del plano.
    if (scrollsY && node.scrollHeight > node.clientHeight) return true
  }
  return false
}
