/**
 * Atajos globales para «nueva terminal en la pestaña activa».
 *
 * Ctrl+J queda excluido a propósito: en una terminal Ctrl+J es LF (equivalente a
 * Enter) y capturarlo rompería el shell en Windows/Linux. ⌘J sigue la convención
 * de VS Code/Cursor en macOS.
 */
export interface ShortcutEventLike {
  key: string
  code?: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
}

export function isNewTerminalShortcut(e: ShortcutEventLike): boolean {
  if (e.altKey || e.shiftKey) return false
  if (!(e.metaKey || e.ctrlKey)) return false

  if (e.key === 'y' || e.key === 'Y' || e.code === 'KeyY') return true

  if ((e.key === 'j' || e.key === 'J' || e.code === 'KeyJ') && e.metaKey) return true

  return false
}

/** Los dos composers sí aceptan el atajo; el resto de campos de texto no. */
export function isNewTerminalShortcutTargetAllowed(target: HTMLElement | null): boolean {
  if (target === null) return true
  if (target.closest('.xterm')) return false
  if (target.closest('.plane-chat-composer') || target.closest('.agent-pane__composer')) return true
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false
  if (target.isContentEditable) return false
  return true
}

/** Terminal de la pestaña donde aterriza el atajo: la última no-agente, o null. */
export function pickTerminalPaneId(
  paneIds: readonly string[],
  paneKinds: Record<string, unknown> | undefined,
): string | null {
  for (let i = paneIds.length - 1; i >= 0; i--) {
    const id = paneIds[i]
    if (paneKinds?.[id] !== 'agent') return id
  }
  return null
}
