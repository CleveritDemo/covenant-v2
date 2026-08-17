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
