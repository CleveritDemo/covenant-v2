/**
 * Registro de cwd con turno del curador manual activo.
 * Vive en un módulo aparte para romper el ciclo de imports entre
 * `wikiCurator.ts` (consulta barrido) y `wikiCuratorSweep.ts` (consulta curador).
 */

const activeCuratorCwds = new Set<string>()

function normalizeCwd(cwd: string): string {
  return typeof cwd === 'string' ? cwd.trim() : ''
}

export function markWikiCuratorActive(cwd: string): void {
  const trimmed = normalizeCwd(cwd)
  if (trimmed) activeCuratorCwds.add(trimmed)
}

export function clearWikiCuratorActive(cwd: string): void {
  const trimmed = normalizeCwd(cwd)
  if (trimmed) activeCuratorCwds.delete(trimmed)
}

export function isWikiCuratorActive(cwd: string): boolean {
  const trimmed = normalizeCwd(cwd)
  return trimmed ? activeCuratorCwds.has(trimmed) : false
}

/** Solo tests: limpia el registro de curadores activos. */
export function clearWikiCuratorActiveForTests(): void {
  activeCuratorCwds.clear()
}
