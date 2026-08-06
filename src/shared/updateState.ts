// Estado del auto-updater compartido entre main (electron/selfUpdate.ts),
// preload y renderer (UpdateBanner).

export type UpdateState =
  | { kind: 'idle' }
  /** Hay versión nueva; aún no se ha descargado nada. */
  | { kind: 'available'; version: string; notes: string | null }
  | { kind: 'downloading'; version: string; percent: number }
  /** Descargada y lista: se instala al salir de la app. */
  | { kind: 'ready'; version: string; notes: string | null }
  | { kind: 'error'; message: string }

/** Notas tal y como las entrega electron-updater. */
export type RawReleaseNotes =
  | string
  | Array<{ version: string; note: string | null }>
  | null
  | undefined

/**
 * Normaliza las notas a un solo string Markdown.
 *
 * El `.yml` que publica CI las trae en Markdown (`releaseInfo.releaseNotesFile`).
 * Si faltan, el proveedor de GitHub las saca del feed Atom como HTML y una entrada
 * por versión: se concatenan con un encabezado por versión.
 * ponytail: el HTML del fallback se muestra literal (AiMarkdown escapa) — feo pero
 * seguro; se arregla publicando las notas en el yml, que es el camino normal.
 */
export function formatReleaseNotes(raw: RawReleaseNotes): string | null {
  if (!raw) return null
  if (typeof raw === 'string') return raw.trim() || null
  const parts = raw
    .filter(entry => entry.note?.trim())
    .map(entry => `## ${entry.version}\n\n${entry.note!.trim()}`)
  return parts.length ? parts.join('\n\n') : null
}
