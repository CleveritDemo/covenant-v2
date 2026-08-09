import type { FileExplorerEntry, FileExplorerListResult } from '@shared/fileExplorerTypes'

/** Orden estable: carpetas primero, luego nombre. */
export function sortExplorerEntries(entries: FileExplorerEntry[]): FileExplorerEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

/** ¿Dos listados de directorio son idénticos entrada por entrada? */
function sameEntries(a: FileExplorerEntry[] | undefined, b: FileExplorerEntry[]): boolean {
  if (!a || a.length !== b.length) return false
  return a.every((entry, i) =>
    entry.relPath === b[i].relPath
    && entry.name === b[i].name
    && entry.isDirectory === b[i].isDirectory)
}

/**
 * Fusiona el listado de un dir (+ prefetch depth-1) en el cache del árbol.
 * No sobrescribe claves ya presentes (salvo el `relPath` pedido).
 *
 * Devuelve el MISMO Map cuando nada cambió. `visibleRows` es un `useMemo` sobre
 * `childrenByDir`, así que devolver siempre un Map nuevo rehacía la lista entera
 * de filas en cada respuesta de `listDir` — incluso cuando el directorio venía
 * byte a byte igual. Con el watcher de fs y las recargas de dirs expandidos eso
 * son ráfagas de recomputados por una sola interacción, y se ve como parpadeo.
 */
export function mergeListDirIntoCache(
  cache: Map<string, FileExplorerEntry[]>,
  relPath: string,
  result: Pick<FileExplorerListResult, 'ok' | 'entries' | 'prefetched'>,
): Map<string, FileExplorerEntry[]> {
  const pending: Array<[string, FileExplorerEntry[]]> = []

  const own = result.ok ? sortExplorerEntries(result.entries) : []
  if (!sameEntries(cache.get(relPath), own)) pending.push([relPath, own])

  if (result.ok && result.prefetched) {
    for (const [path, entries] of Object.entries(result.prefetched)) {
      if (cache.has(path)) continue
      pending.push([path, sortExplorerEntries(entries)])
    }
  }

  if (pending.length === 0) return cache

  const next = new Map(cache)
  for (const [path, entries] of pending) next.set(path, entries)
  return next
}
