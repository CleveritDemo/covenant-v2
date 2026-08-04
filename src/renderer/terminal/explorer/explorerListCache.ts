import type { FileExplorerEntry, FileExplorerListResult } from '@shared/fileExplorerTypes'

/** Orden estable: carpetas primero, luego nombre. */
export function sortExplorerEntries(entries: FileExplorerEntry[]): FileExplorerEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

/**
 * Fusiona el listado de un dir (+ prefetch depth-1) en el cache del árbol.
 * No sobrescribe claves ya presentes (salvo el `relPath` pedido).
 */
export function mergeListDirIntoCache(
  cache: Map<string, FileExplorerEntry[]>,
  relPath: string,
  result: Pick<FileExplorerListResult, 'ok' | 'entries' | 'prefetched'>,
): Map<string, FileExplorerEntry[]> {
  const next = new Map(cache)
  next.set(relPath, result.ok ? sortExplorerEntries(result.entries) : [])
  if (result.ok && result.prefetched) {
    for (const [path, entries] of Object.entries(result.prefetched)) {
      if (next.has(path)) continue
      next.set(path, sortExplorerEntries(entries))
    }
  }
  return next
}
