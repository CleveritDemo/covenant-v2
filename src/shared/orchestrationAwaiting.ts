/**
 * Presentación pura del estado de ola de delegaciones (awaiting).
 * Sin React/electron: App arma inputs desde refs; UI solo renderiza la vista.
 */

import {
  formatCatalogAgentDelegationLabel,
  type ProjectAgentDefinition,
} from './projectAgentCatalog'

/**
 * `deferred` es una delegación aceptada que todavía no arrancó (el pane destino
 * estaba ocupado y se serializó en la cola del orquestador). Se separó de `running`
 * porque pintarlas igual hacía leer como "trabajando" a un especialista parado.
 */
export type OrchestrationAwaitingItemStatus = 'running' | 'deferred' | 'done'

export interface OrchestrationAwaitingItemInput {
  delegationId: string
  toAgentId: string
  /** Job de orquestación (grupo por turno humano). */
  jobId?: string
  /** Pane especialista en vuelo (para Stop por fila). */
  toPaneId?: string
  /** Carril de hilo del experto base que ejecuta la delegación. */
  toThreadId?: string
  status: OrchestrationAwaitingItemStatus
  worktreePath?: string
}

export interface OrchestrationAwaitingItemView {
  delegationId: string
  /** Nombre del experto (agentId tal cual). */
  agentLabel: string
  status: OrchestrationAwaitingItemStatus
  /** Job de orquestación (grupo por turno humano). */
  jobId?: string
  /** Pane destino si la ola lo conoce (Stop por fila). */
  toPaneId?: string
  /** Último segmento útil del worktree (barato, sin IPC). */
  worktreeHint?: string
}

export interface OrchestrationAwaitingGroupView {
  jobId: string
  /** 1-based por primera aparición del jobId en la lista de entrada. */
  index: number
  /** Preview del turno humano si el job lo trae; la UI pinta el rótulo. */
  title?: string
  done: number
  total: number
  items: OrchestrationAwaitingItemView[]
}

export interface OrchestrationAwaitingView {
  done: number
  total: number
  items: OrchestrationAwaitingItemView[]
  groups: OrchestrationAwaitingGroupView[]
}

/**
 * Firma corta para igualdad / throttle: done/total + jobId corto:id:status por fila.
 * Detecta cambios de status o de grupo aunque awaitingDelegations siga true.
 */
export function orchestrationAwaitingSignature(
  view: OrchestrationAwaitingView | null | undefined,
): string {
  if (!view) return ''
  return `${view.done}/${view.total}:${view.items.map(item => `${(item.jobId ?? '').slice(0, 8)}:${item.delegationId}:${item.status}`).join(',')}`
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

export interface BuildOrchestrationAwaitingViewOptions {
  catalog?: readonly ProjectAgentDefinition[]
  jobsMeta?: readonly { jobId: string; createdAt?: number; humanRequestPreview?: string }[]
}

function groupAwaitingItems(
  views: readonly OrchestrationAwaitingItemView[],
  jobsMeta?: BuildOrchestrationAwaitingViewOptions['jobsMeta'],
): OrchestrationAwaitingGroupView[] {
  const metaByJobId = new Map<string, { createdAt?: number; humanRequestPreview?: string }>()
  for (const meta of jobsMeta ?? []) {
    const id = meta.jobId.trim()
    if (!id || metaByJobId.has(id)) continue
    metaByJobId.set(id, meta)
  }

  const order: string[] = []
  const buckets = new Map<string, OrchestrationAwaitingItemView[]>()
  const ungrouped: OrchestrationAwaitingItemView[] = []

  for (const view of views) {
    const jobId = view.jobId?.trim() ?? ''
    if (!jobId) {
      ungrouped.push(view)
      continue
    }
    const bucket = buckets.get(jobId)
    if (bucket) {
      bucket.push(view)
    } else {
      order.push(jobId)
      buckets.set(jobId, [view])
    }
  }

  const groups: OrchestrationAwaitingGroupView[] = order.map((jobId, i) => {
    const groupItems = buckets.get(jobId) ?? []
    const preview = metaByJobId.get(jobId)?.humanRequestPreview?.trim()
    return {
      jobId,
      index: i + 1,
      ...(preview ? { title: preview } : {}),
      done: groupItems.filter(item => item.status === 'done').length,
      total: groupItems.length,
      items: groupItems,
    }
  })

  if (ungrouped.length) {
    groups.push({
      jobId: '',
      index: groups.length + 1,
      done: ungrouped.filter(item => item.status === 'done').length,
      total: ungrouped.length,
      items: ungrouped,
    })
  }
  return groups
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
    const jobId = item.jobId?.trim()
    return {
      delegationId: item.delegationId,
      agentLabel: labelForExpertId(to || item.delegationId),
      status: item.status,
      ...(jobId ? { jobId } : {}),
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
    groups: groupAwaitingItems(views, options?.jobsMeta),
  }
}
