/**
 * Señales de trabajo vivo en un pane agente (dot de tab / presencia).
 * No incluye queuedTurns: cola humana pendiente no es ejecución.
 */
export interface PaneWorkStatusSlice {
  busy?: boolean
  /** Orquestador esperando resultados de especialistas — trabajo activo. */
  awaitingDelegations?: boolean
  delegationWorkActive?: boolean
  orchestratorBusy?: boolean
  loopActive?: boolean
  localLoopActive?: boolean
}

/** True si el pane tiene ejecución, delegación, loop u orquestación en curso. */
export function isPaneWorkActive(
  paneId: string,
  busyPanes: ReadonlySet<string>,
  delegationTargetPaneIds: ReadonlySet<string>,
  status?: PaneWorkStatusSlice | null,
): boolean {
  if (busyPanes.has(paneId)) return true
  if (delegationTargetPaneIds.has(paneId)) return true
  if (!status) return false
  return Boolean(
    status.busy
    || status.delegationWorkActive
    || status.orchestratorBusy
    || status.loopActive
    || status.localLoopActive
    || status.awaitingDelegations,
  )
}

export function collectBusyTabIds(
  tabs: ReadonlyArray<{ id: string; paneIds: readonly string[] }>,
  busyPanes: ReadonlySet<string>,
  delegationTargetPaneIds: ReadonlySet<string>,
  agentPlaneStatus: Readonly<Record<string, PaneWorkStatusSlice | undefined>>,
): Set<string> {
  const ids = new Set<string>()
  for (const tab of tabs) {
    if (tab.paneIds.some(pid => isPaneWorkActive(
      pid,
      busyPanes,
      delegationTargetPaneIds,
      agentPlaneStatus[pid],
    ))) {
      ids.add(tab.id)
    }
  }
  return ids
}
