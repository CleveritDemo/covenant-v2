/**
 * Lógica pura de delegación por `git worktree` (Fase 2).
 *
 * Vive en `src/shared/` porque la consume tanto el renderer (Fase 4, App.tsx) como
 * electron — sin imports de `electron`, `react` ni `fs`. Toda composición de rutas es
 * mediante strings (no se usa el módulo `path` de Node) para mantener determinismo
 * total en tests, sin depender del separador del SO.
 *
 * DOBLE VALIDACIÓN (documentado): las reglas de seguridad reales (rechazo de prefijo
 * `-`, `..`, caracteres de control, containment dentro de `<baseCwd>/.gravity/worktrees/`)
 * viven en `electron/gitWorktreeOps.ts` (`isSafeSegment` / `resolveSafeWorktreePath`) y
 * son las que efectivamente autorizan la ejecución de git. Esta capa NO las duplica: se
 * limita a producir valores *ya seguros por construcción* (slugs derivados de ids
 * internos vía `sanitizeDelegationSlug`), que la capa IPC vuelve a revalidar de forma
 * independiente antes de invocar git (defensa en profundidad).
 */

/** Segmento relativo (a `baseCwd`) bajo el que se crean los worktrees de delegación. */
export const WORKTREES_DIR_SEGMENT = '.gravity/worktrees'

const MAX_SLUG_LENGTH = 40
const FALLBACK_SLUG = 'x'

/**
 * Normaliza un id arbitrario (delegationId/agentId/tabId) a un slug `[a-z0-9-]`,
 * colapsando separadores repetidos, recortado a ~40 chars, y que NUNCA empieza por
 * `-`/`.` ni contiene `..` — garantiza que el resultado siempre pasa `isSafeSegment`.
 */
export function sanitizeDelegationSlug(raw: string): string {
  const lowered = String(raw ?? '').toLowerCase()
  // Sustituye cualquier carácter fuera de [a-z0-9] por '-', colapsa repetidos.
  const collapsed = lowered
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

  const truncated = collapsed.slice(0, MAX_SLUG_LENGTH).replace(/-+$/, '')

  if (!truncated || truncated.startsWith('-') || truncated.startsWith('.')) {
    return FALLBACK_SLUG
  }
  return truncated
}

/** Rama determinista para el worktree de una delegación. */
export function worktreeBranchFor(delegationId: string): string {
  return `gravity/deleg/${sanitizeDelegationSlug(delegationId)}`
}

/**
 * Path RELATIVO (a `baseCwd`) del worktree de una delegación, bajo `WORKTREES_DIR_SEGMENT`.
 * La Fase 4 lo une con `baseCwd`; la capa IPC (`resolveSafeWorktreePath`) revalida
 * containment antes de tocar disco.
 */
export function worktreeRelPathFor(tabId: string, delegationId: string): string {
  return `${WORKTREES_DIR_SEGMENT}/${sanitizeDelegationSlug(tabId)}/${sanitizeDelegationSlug(delegationId)}`
}

export interface WorktreeMergeItem {
  delegationId: string
  completedAt: number
}

/**
 * Orden determinista y secuencial de merge: por `completedAt` ascendente, desempate
 * por `delegationId` ascendente (estable ante empates exactos de timestamp).
 */
export function planWorktreeMergeOrder(items: WorktreeMergeItem[]): string[] {
  return [...items]
    .sort((a, b) => {
      if (a.completedAt !== b.completedAt) return a.completedAt - b.completedAt
      return a.delegationId < b.delegationId ? -1 : a.delegationId > b.delegationId ? 1 : 0
    })
    .map(item => item.delegationId)
}

export interface MergeCommitInput {
  agentId: string
  toAgentId?: string
  objectiveFirstLine: string
  delegationId: string
}

const OBJECTIVE_TRUNC_LENGTH = 72

/** Mensaje de commit de merge, una sola línea, con el objetivo truncado a 72 chars. */
export function buildMergeCommitMessage(input: MergeCommitInput): string {
  const objective = String(input.objectiveFirstLine ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
  const truncated =
    objective.length > OBJECTIVE_TRUNC_LENGTH
      ? `${objective.slice(0, OBJECTIVE_TRUNC_LENGTH - 1).trimEnd()}…`
      : objective
  const slug = sanitizeDelegationSlug(input.delegationId)
  return `merge(deleg): ${truncated} [${slug}]`
}

export interface ConflictFollowUpInput {
  conflictFiles: string[]
  branch: string
}

/** Texto de re-delegación para resolver conflictos de merge (sin fences ni JSON). */
export function buildConflictFollowUp(input: ConflictFollowUpInput): string {
  const files = Array.isArray(input.conflictFiles) ? input.conflictFiles : []
  const branch = String(input.branch ?? '')
  const fileList = files.length > 0 ? files.map(f => `- ${f}`).join('\n') : '- (sin archivos listados)'
  return [
    `El merge de la rama "${branch}" generó conflictos en los siguientes archivos:`,
    fileList,
    `Por favor resuelve los conflictos directamente en el worktree de la rama "${branch}", `
      + 'deja el árbol de trabajo limpio y crea un nuevo commit con la resolución.',
  ].join('\n')
}

export interface ShouldUseWorktreeInput {
  isGitRepo: boolean
  hasBaseBranch: boolean
}

/** Solo se usa worktree si el cwd es un repo git y hay una rama base resuelta. */
export function shouldUseWorktreeForDelegation(input: ShouldUseWorktreeInput): boolean {
  return input.isGitRepo && input.hasBaseBranch
}
