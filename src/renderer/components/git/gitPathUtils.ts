import type { GitPathEntry } from '@shared/gitSessionTypes'

const RENAME_ARROW = ' -> '

/** Ruta en el worktree (destino en renombres de porcelana). */
export function gitWorktreePath(entry: GitPathEntry): string {
  const idx = entry.path.indexOf(RENAME_ARROW)
  return idx >= 0 ? entry.path.slice(idx + RENAME_ARROW.length).trim() : entry.path
}

/** Archivo completamente en staging (sin cambios pendientes en worktree). */
export function isGitEntryFullyStaged(entry: GitPathEntry): boolean {
  if (entry.status === '??') return false
  const index = entry.status[0] ?? ' '
  const worktree = entry.status[1] ?? ' '
  return index !== ' ' && index !== '?' && worktree === ' '
}

/** Se puede quitar del staging. */
export function canGitUnstageEntry(entry: GitPathEntry): boolean {
  return hasGitStagedChanges(entry)
}

/** Se puede añadir al staging (untracked o con cambios sin stage). */
export function canGitStageEntry(entry: GitPathEntry): boolean {
  if (entry.status === '??') return true
  const index = entry.status[0] ?? ' '
  const worktree = entry.status[1] ?? ' '
  return worktree !== ' ' || index === ' '
}

/** Tiene cambios en el índice (staging). */
export function hasGitStagedChanges(entry: GitPathEntry): boolean {
  if (entry.status === '??') return false
  const index = entry.status[0] ?? ' '
  return index !== ' ' && index !== '?'
}

/** Tiene cambios en el worktree (sin stage o untracked). */
export function hasGitUnstagedChanges(entry: GitPathEntry): boolean {
  if (entry.status === '??') return true
  const worktree = entry.status[1] ?? ' '
  return worktree !== ' '
}

export function splitGitFilesByArea(files: GitPathEntry[]): {
  unstaged: GitPathEntry[]
  staged: GitPathEntry[]
} {
  const unstaged: GitPathEntry[] = []
  const staged: GitPathEntry[] = []
  for (const entry of files) {
    if (hasGitUnstagedChanges(entry)) unstaged.push(entry)
    if (hasGitStagedChanges(entry)) staged.push(entry)
  }
  return { unstaged, staged }
}

/** Nombre corto para la fila (basename del path en worktree). */
export function gitDisplayFileName(entry: GitPathEntry): string {
  const path = gitWorktreePath(entry)
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return slash >= 0 ? path.slice(slash + 1) : path
}

/**
 * Últimos N segmentos de una ruta absoluta (p. ej. cwd del panel git).
 * `/Users/.../covenant/covenant-v2` → `covenant/covenant-v2`.
 */
export function shortPathTail(path: string, segments = 2): string {
  const trimmed = path.trim().replace(/[/\\]+$/, '')
  if (!trimmed) return ''
  const parts = trimmed.split(/[/\\]+/).filter(Boolean)
  if (parts.length === 0) return trimmed
  const n = Math.max(1, Math.floor(segments))
  return parts.slice(-n).join('/')
}

/** Directorio (con separador final) y nombre, para pintar la ruta con el directorio atenuado. */
export function gitSplitDisplayPath(entry: GitPathEntry): { dir: string; name: string } {
  const path = gitWorktreePath(entry)
  const slash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return slash >= 0
    ? { dir: path.slice(0, slash + 1), name: path.slice(slash + 1) }
    : { dir: '', name: path }
}

/** Filtra por subcadena sobre la ruta completa (sin distinguir mayúsculas). */
export function filterGitEntries(files: GitPathEntry[], query: string): GitPathEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return files
  return files.filter(entry => gitWorktreePath(entry).toLowerCase().includes(q))
}

export type GitStatusKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typeChange'
  | 'untracked'
  | 'conflict'
  | 'other'

const CODE_KIND: Record<string, GitStatusKind> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  T: 'typeChange',
}

/** Letra mostrada en el chip de estado (la porcelana cruda queda en el `title`). */
export const GIT_STATUS_LETTER: Record<GitStatusKind, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  typeChange: 'T',
  untracked: 'U',
  conflict: '!',
  other: '·',
}

/** Traduce el estado porcelana del área pedida a un tipo con significado. */
export function gitStatusKind(entry: GitPathEntry, area: 'index' | 'worktree'): GitStatusKind {
  if (entry.status === '??') return 'untracked'
  // Conflicto: cualquier `U`, más los casos AA/DD de ambos lados.
  if (entry.status.includes('U') || entry.status === 'AA' || entry.status === 'DD') return 'conflict'
  const code = (area === 'index' ? entry.status[0] : entry.status[1]) ?? ' '
  return CODE_KIND[code] ?? 'other'
}
