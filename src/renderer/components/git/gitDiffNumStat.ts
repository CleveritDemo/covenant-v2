import type { GitPathEntry } from '@shared/gitSessionTypes'
import { gitWorktreePath, hasGitStagedChanges, hasGitUnstagedChanges } from './gitPathUtils'

export interface GitFileLineStats {
  insertions: number
  deletions: number
}

/** Parsea salida de `git diff --numstat` (tab-separated). */
export function parseGitNumStat(text: string): Map<string, GitFileLineStats> {
  const map = new Map<string, GitFileLineStats>()
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const rest = line.slice(tab + 1)
    const tab2 = rest.indexOf('\t')
    if (tab2 < 0) continue
    const insRaw = line.slice(0, tab).trim()
    const delRaw = rest.slice(0, tab2).trim()
    const path = rest.slice(tab2 + 1).trim()
    if (!path) continue
    map.set(path, {
      insertions: insRaw === '-' ? 0 : Number.parseInt(insRaw, 10) || 0,
      deletions: delRaw === '-' ? 0 : Number.parseInt(delRaw, 10) || 0,
    })
  }
  return map
}

function numStatLookupPaths(entry: GitPathEntry): string[] {
  const worktree = gitWorktreePath(entry)
  const paths = new Set<string>([worktree, entry.path])
  const arrow = ' -> '
  if (entry.path.includes(arrow)) {
    for (const part of entry.path.split(arrow)) {
      const p = part.trim()
      if (p) paths.add(p)
    }
  }
  return [...paths]
}

/** Stats de un archivo en un área concreta (staged o unstaged), sin sumar la otra. */
export function gitEntryAreaStats(
  entry: GitPathEntry,
  map: Map<string, GitFileLineStats>,
): GitFileLineStats | null {
  return lookupGitNumStat(map, entry) ?? null
}

/** Suma de líneas de un conjunto de archivos dentro de una misma área. */
export function gitAreaTotals(
  entries: GitPathEntry[],
  map: Map<string, GitFileLineStats>,
): GitFileLineStats {
  let insertions = 0
  let deletions = 0
  for (const entry of entries) {
    const stats = lookupGitNumStat(map, entry)
    if (!stats) continue
    insertions += stats.insertions
    deletions += stats.deletions
  }
  return { insertions, deletions }
}

function lookupGitNumStat(
  map: Map<string, GitFileLineStats>,
  entry: GitPathEntry,
): GitFileLineStats | undefined {
  for (const path of numStatLookupPaths(entry)) {
    const stats = map.get(path)
    if (stats) return stats
  }
  return undefined
}

/** Suma inserciones/borrados staged + unstaged según el estado porcelana del archivo. */
export function gitFileLineStats(
  entry: GitPathEntry,
  unstagedMap: Map<string, GitFileLineStats>,
  stagedMap: Map<string, GitFileLineStats>,
): GitFileLineStats | null {
  let insertions = 0
  let deletions = 0
  let found = false

  if (hasGitUnstagedChanges(entry)) {
    const stats = lookupGitNumStat(unstagedMap, entry)
    if (stats) {
      insertions += stats.insertions
      deletions += stats.deletions
      found = true
    }
  }
  if (hasGitStagedChanges(entry)) {
    const stats = lookupGitNumStat(stagedMap, entry)
    if (stats) {
      insertions += stats.insertions
      deletions += stats.deletions
      found = true
    }
  }

  return found ? { insertions, deletions } : null
}
