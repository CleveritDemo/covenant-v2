import type { GitPathEntry, GitRepoStatus } from '@shared/gitSessionTypes'

export type ExplorerGitStatus = 'new' | 'modified' | 'deleted' | 'staged' | 'conflict'

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

/** Prefijo de rutas del repo relativas al cwd de la sesión (raíz del árbol). */
export function repoPrefixFromStatus(status: GitRepoStatus): string {
  if (!status.isRepo || !status.repoRoot) return ''
  const repoRoot = normalizePath(status.repoRoot)
  const sessionCwd = normalizePath(status.sessionCwd)
  if (sessionCwd === repoRoot) return ''
  if (!sessionCwd.startsWith(`${repoRoot}/`)) return ''
  return sessionCwd.slice(repoRoot.length + 1)
}

function porcelainPath(path: string): string {
  const arrow = path.indexOf(' -> ')
  return arrow >= 0 ? path.slice(arrow + 4) : path
}

function porcelainToStatus(status: string): ExplorerGitStatus {
  if (status.includes('U') || status === 'AA' || status === 'DD') return 'conflict'
  if (status === '??') return 'new'
  if (status[0] === 'A' || status[1] === 'A') return 'staged'
  if (status[0] === 'D' || status[1] === 'D') return 'deleted'
  return 'modified'
}

function mergeStatus(
  current: ExplorerGitStatus | undefined,
  next: ExplorerGitStatus,
): ExplorerGitStatus {
  const priority: ExplorerGitStatus[] = ['conflict', 'deleted', 'staged', 'modified', 'new']
  const currentIdx = current ? priority.indexOf(current) : priority.length
  const nextIdx = priority.indexOf(next)
  return nextIdx < currentIdx ? next : (current ?? next)
}

function repoPathToExplorerPath(repoPath: string, prefix: string): string | null {
  if (!prefix) return repoPath
  if (repoPath === prefix) return ''
  if (repoPath.startsWith(`${prefix}/`)) return repoPath.slice(prefix.length + 1)
  return null
}

/** Mapa relPath del explorador → estado git (incluye carpetas con cambios en descendientes). */
export function buildGitStatusMap(status: GitRepoStatus): Map<string, ExplorerGitStatus> {
  if (!status.isRepo) return new Map()

  const prefix = repoPrefixFromStatus(status)
  const result = new Map<string, ExplorerGitStatus>()

  for (const entry of status.files) {
    const repoPath = porcelainPath(entry.path)
    const explorerPath = repoPathToExplorerPath(repoPath, prefix)
    if (explorerPath === null) continue

    const gitStatus = porcelainToStatus(entry.status)
    result.set(explorerPath, mergeStatus(result.get(explorerPath), gitStatus))

    let dir = explorerPath
    while (dir.includes('/')) {
      dir = dir.slice(0, dir.lastIndexOf('/'))
      result.set(dir, mergeStatus(result.get(dir), gitStatus))
    }
  }

  return result
}

export function gitStatusFromMap(
  map: Map<string, ExplorerGitStatus>,
  relPath: string,
): ExplorerGitStatus | null {
  return map.get(relPath) ?? null
}

/**
 * ¿Dos mapas de estado git son equivalentes? `buildGitStatusMap` siempre
 * construye un Map nuevo, y el watcher del explorador lo llama varias veces por
 * segundo; sin esta comparación cada llamada re-renderiza el árbol entero
 * aunque git no haya cambiado nada.
 */
export function sameGitStatusMap(
  a: Map<string, ExplorerGitStatus>,
  b: Map<string, ExplorerGitStatus>,
): boolean {
  if (a.size !== b.size) return false
  for (const [path, status] of a) {
    if (b.get(path) !== status) return false
  }
  return true
}
