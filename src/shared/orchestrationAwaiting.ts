/**
 * Presentación pura del estado de ola de delegaciones (awaiting).
 * Sin React/electron: App arma inputs desde refs; UI solo renderiza la vista.
 */

import { agentInstanceTag, parseExpertReplicaRequest } from './expertReplicas'

/**
 * `deferred` es una delegación aceptada que todavía no arrancó (el pane destino
 * estaba ocupado y no se permitió réplica). Se separó de `running` porque
 * pintarlas igual hacía leer como "trabajando" a un especialista parado.
 */
export type OrchestrationAwaitingItemStatus = 'running' | 'deferred' | 'done'

export interface OrchestrationAwaitingItemInput {
  delegationId: string
  toAgentId: string
  /** Pane especialista en vuelo (para Stop por fila). */
  toPaneId?: string
  /** Si la ruta usó un experto base distinto (réplica spawn). */
  baseAgentId?: string
  status: OrchestrationAwaitingItemStatus
  worktreePath?: string
}

export interface OrchestrationAwaitingItemView {
  delegationId: string
  /** Nombre del experto: en una réplica, el del base (`frontend`, no `frontend-2`). */
  agentLabel: string
  /** Tag de instancia de la réplica (`R2`); ausente en el experto base. */
  instanceTag?: string
  status: OrchestrationAwaitingItemStatus
  /** Pane destino si la ola lo conoce (Stop por fila). */
  toPaneId?: string
  /** Último segmento útil del worktree (barato, sin IPC). */
  worktreeHint?: string
}

export interface OrchestrationAwaitingView {
  done: number
  total: number
  items: OrchestrationAwaitingItemView[]
}

/** Heurística: `frontend-2` es réplica de `frontend` si no hay base explícita. */
export function isReplicaAgentId(toAgentId: string, baseAgentId?: string): boolean {
  const to = toAgentId.trim().toLowerCase()
  if (!to) return false
  const base = baseAgentId?.trim().toLowerCase()
  if (base) return to !== base
  return /^.+-\d+$/i.test(to)
}

/**
 * Réplica efímera a borrar al completar/abortar: solo si el pending trajo
 * `baseAgentId` (spawn). Nunca el experto base.
 */
export function shouldDisposeReplicaOnComplete(input: {
  toAgentId: string
  baseAgentId?: string
}): boolean {
  const base = input.baseAgentId?.trim()
  if (!base) return false
  return isReplicaAgentId(input.toAgentId, base)
}

/** Hint corto del path de worktree (p. ej. `tab/dlg-id`). */
export function shortWorktreeHint(worktreePath: string | undefined): string | undefined {
  const raw = worktreePath?.trim()
  if (!raw) return undefined
  const normalized = raw.replace(/\\/g, '/').replace(/\/+$/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0) return undefined
  const idx = parts.findIndex(part => part === 'worktrees')
  if (idx >= 0 && parts[idx + 1] && parts[idx + 2]) {
    return `${parts[idx + 1]}/${parts[idx + 2]}`
  }
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  return parts[parts.length - 1]
}

export function buildOrchestrationAwaitingView(
  items: readonly OrchestrationAwaitingItemInput[],
): OrchestrationAwaitingView | null {
  if (!items.length) return null
  const views: OrchestrationAwaitingItemView[] = items.map(item => {
    const to = item.toAgentId.trim()
    const replica = isReplicaAgentId(to, item.baseAgentId)
    const tag = replica ? agentInstanceTag(to) : null
    return {
      delegationId: item.delegationId,
      // Con tag, el nombre visible es el del experto: "frontend R2", no "frontend-2 R2".
      agentLabel: (tag ? (item.baseAgentId?.trim() || parseExpertReplicaRequest(to).baseId) : to)
        || item.delegationId,
      ...(tag ? { instanceTag: tag } : {}),
      status: item.status,
      ...(item.toPaneId?.trim() ? { toPaneId: item.toPaneId.trim() } : {}),
      ...(shortWorktreeHint(item.worktreePath)
        ? { worktreeHint: shortWorktreeHint(item.worktreePath) }
        : {}),
    }
  })
  const done = views.filter(item => item.status === 'done').length
  return {
    done,
    total: views.length,
    items: views,
  }
}
