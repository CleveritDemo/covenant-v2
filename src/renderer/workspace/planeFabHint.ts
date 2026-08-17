/** Etiqueta del modificador de atajo según plataforma. */
export function fabAccelLabel(isMac: boolean): string {
  return isMac ? '⌘' : 'Ctrl+'
}

/** Atajo + pista opcional para el hint del Tooltip del FAB. */
export function fabHintWithShortcut(hint: string, keyLabel: string, isMac: boolean): string {
  const trimmed = hint.trim()
  const shortcut = `${fabAccelLabel(isMac)}${keyLabel}`
  if (!trimmed) return shortcut
  return `${shortcut} · ${trimmed}`
}
