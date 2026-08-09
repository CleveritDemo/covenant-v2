import type { GitWorktreeEntry } from '@shared/gitWorktree'
import type { SelectOption } from '../ui/Select'

function dirName(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || normalized
}

/**
 * Opciones del selector de worktrees del panel Git: nombre de carpeta arriba,
 * rama debajo. El primero que devuelve `git worktree list` es el principal.
 */
export function gitWorktreeOptions(entries: GitWorktreeEntry[]): SelectOption[] {
  return entries
    .filter(entry => entry.path.trim())
    .map((entry, index) => ({
      value: entry.path,
      label: dirName(entry.path),
      hint: [index === 0 ? 'main worktree' : '', entry.branch || entry.head.slice(0, 7)]
        .filter(Boolean)
        .join(' · '),
    }))
}
