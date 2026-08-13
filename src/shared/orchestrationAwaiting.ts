/**
 * Presentación pura del estado de ola de delegaciones (awaiting).
 * Sin React/electron: App arma inputs desde refs; UI solo renderiza la vista.
 */

import { agentInstanceTag, parseExpertReplicaRequest } from './expertReplicas'
import {
  formatCatalogAgentDelegationLabel,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'

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
  /** Nombre + rol del catálogo; en réplica, el del experto base (no el slug `frontend-2`). */
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

/**
 * Firma corta para igualdad / throttle: done/total + id:status por fila.
 * Detecta cambios de status aunque awaitingDelegations siga true.
 */
export function orchestrationAwaitingSignature(
  view: OrchestrationAwaitingView | null | undefined,
): string {
  if (!view) return ''
  return `${view.done}/${view.total}:${view.items.map(item => `${item.delegationId}:${item.status}`).join(',')}`
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
 * Réplica efímera a borrar al completar/abortar.
 * Marcadores de spawn: `baseAgentId` en el pending, o `localOnly` en el binding
 * / definición (red de seguridad si el pending o el registry se perdieron).
 * Nunca el experto base.
 */
export function shouldDisposeReplicaOnComplete(input: {
  toAgentId: string
  baseAgentId?: string
  localOnly?: boolean
}): boolean {
  if (input.localOnly === true) return true
  const base = input.baseAgentId?.trim()
  if (!base) return false
  return isReplicaAgentId(input.toAgentId, base)
}

export interface ReplicaPaneMatchInput {
  paneId: string
  agentId?: string
  localOnly?: boolean
}

/**
 * Localiza el pane de una réplica cuando el pending y el registry ya no están.
 * Prioridad: `toPaneId` del resultado; si falta, binding `localOnly` con el mismo agent id.
 */
export function matchReplicaPane(input: {
  toPaneId?: string
  toAgentId?: string
  panes: ReadonlyArray<ReplicaPaneMatchInput>
}): ReplicaPaneMatchInput | undefined {
  const paneId = input.toPaneId?.trim()
  if (paneId) {
    return input.panes.find(item => item.paneId === paneId) ?? { paneId }
  }
  const agentId = input.toAgentId?.trim().toLowerCase()
  if (!agentId) return undefined
  return input.panes.find(item => (
    item.localOnly === true
    && (item.agentId ?? '').trim().toLowerCase() === agentId
  ))
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

/** Diferir dispose de réplicas hasta que la ola termine (pending o deferred vivos). */
export function shouldDeferReplicaDisposeForWave(
  remaining: number,
  deferredLeft: number,
): boolean {
  return remaining > 0 || deferredLeft > 0
}

export interface BuildOrchestrationAwaitingViewOptions {
  catalog?: readonly ProjectAgentDefinition[]
}

export function buildOrchestrationAwaitingView(
  items: readonly OrchestrationAwaitingItemInput[],
  options?: BuildOrchestrationAwaitingViewOptions,
): OrchestrationAwaitingView | null {
  if (!items.length) return null
  const catalog = options?.catalog ?? []
  const labelForExpertId = (expertId: string): string => {
    const id = expertId.trim()
    if (!id) return expertId
    if (catalog.length) return formatCatalogAgentDelegationLabel(id, catalog)
    return id
  }
  const views: OrchestrationAwaitingItemView[] = items.map(item => {
    const to = item.toAgentId.trim()
    const replica = isReplicaAgentId(to, item.baseAgentId)
    const tag = replica ? agentInstanceTag(to) : null
    const expertId = (tag ? (item.baseAgentId?.trim() || parseExpertReplicaRequest(to).baseId) : to)
      || item.delegationId
    return {
      delegationId: item.delegationId,
      agentLabel: labelForExpertId(expertId),
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
