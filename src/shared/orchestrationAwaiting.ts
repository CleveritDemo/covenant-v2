/**
 * Presentación pura del estado de ola de delegaciones (awaiting).
 * Sin React/electron: App arma inputs desde refs; UI solo renderiza la vista.
 */

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
    return {
      delegationId: item.delegationId,
      agentLabel: to || item.delegationId,
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
