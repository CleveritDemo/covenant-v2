/**
 * Señales de trabajo vivo en un pane agente (dot de tab / presencia).
 * No incluye queuedTurns: cola humana pendiente no es ejecución.
 */

/** Variante visual del dot periférico. */
export type PlaneActivityDotKind = 'busy' | 'delegating'

export interface PaneWorkStatusSlice {
  busy?: boolean
  /** Orquestador esperando resultados de especialistas — trabajo activo. */
  awaitingDelegations?: boolean
  delegationWorkActive?: boolean
  orchestratorBusy?: boolean
  /** Hilos en carril o turno activo (incluye conversaciones en fondo). */
  runningThreadIds?: readonly string[]
}

/** True si el pane tiene ejecución, delegación u orquestación en curso. */
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
    || status.awaitingDelegations
    || (status.runningThreadIds?.length ?? 0) > 0,
  )
}

/** Dot del badge en el composer: cualquier hilo o señal de trabajo del pane. */
export function isAgentComposerBadgeActive(
  status: PaneWorkStatusSlice | null | undefined,
  entityBusy = false,
  entityDelegationWorkActive = false,
): boolean {
  if (entityBusy || entityDelegationWorkActive) return true
  if (!status) return false
  return Boolean(
    status.busy
    || status.delegationWorkActive
    || status.orchestratorBusy
    || status.awaitingDelegations
    || (status.runningThreadIds?.length ?? 0) > 0,
  )
}

export interface ResolvePlaneActivityDotOptions {
  paneBusy?: boolean
  delegationTarget?: boolean
  awaitingDelegations?: boolean
}

/**
 * Dot periférico por pane: busy mientras el turno CLI vive; delegating al quedar
 * idle con ola abierta. `paneBusy` / `delegationTarget` cubren App sin espejo.
 */
export function resolvePlaneActivityDot(
  status?: PaneWorkStatusSlice | null,
  options?: ResolvePlaneActivityDotOptions,
): PlaneActivityDotKind | null {
  const awaiting = options?.awaitingDelegations ?? status?.awaitingDelegations
  const cliBusy = Boolean(
    options?.paneBusy
    || options?.delegationTarget
    || status?.busy
    || status?.orchestratorBusy,
  )

  if (cliBusy) return 'busy'
  if (awaiting) return 'delegating'
  if (!status) return null

  if (
    status.delegationWorkActive
    || (status.runningThreadIds?.length ?? 0) > 0
  ) {
    return 'busy'
  }
  return null
}

/** Dot en chip de conversación: delegating en hilo activo solo tras cerrar el turno. */
export function resolveThreadChipActivityDot(
  threadId: string,
  activeThreadId: string,
  awaitingDelegations: boolean,
  runningThreadIds: readonly string[],
  paneCliBusy = false,
  awaitingThreadIds?: readonly string[],
): PlaneActivityDotKind | null {
  if (paneCliBusy) {
    return runningThreadIds.includes(threadId) ? 'busy' : null
  }
  if (awaitingThreadIds?.length) {
    if (awaitingThreadIds.includes(threadId)) return 'delegating'
    if (runningThreadIds.includes(threadId)) return 'busy'
    return null
  }
  if (threadId === activeThreadId && awaitingDelegations) return 'delegating'
  if (runningThreadIds.includes(threadId)) return 'busy'
  return null
}

/** Badge del composer: delegating idle o busy por hilos en fondo. */
export function resolveComposerAgentActivityDot(agent: {
  busy?: boolean
  orchestratorBusy?: boolean
  awaitingDelegations?: boolean
  delegationWorkActive?: boolean
  workActive?: boolean
}): PlaneActivityDotKind | null {
  const dot = resolvePlaneActivityDot({
    busy: agent.busy,
    orchestratorBusy: agent.orchestratorBusy,
    awaitingDelegations: agent.awaitingDelegations,
    delegationWorkActive: agent.delegationWorkActive,
  })
  if (dot) return dot
  return agent.workActive ? 'busy' : null
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

/** Dot por tab: delegating si algún pane orquesta; si no, busy. */
export function collectTabActivityDots(
  tabs: ReadonlyArray<{ id: string; paneIds: readonly string[] }>,
  busyPanes: ReadonlySet<string>,
  delegationTargetPaneIds: ReadonlySet<string>,
  awaitingDelegationPaneIds: ReadonlySet<string>,
  agentPlaneStatus: Readonly<Record<string, PaneWorkStatusSlice | undefined>>,
): Map<string, PlaneActivityDotKind> {
  const out = new Map<string, PlaneActivityDotKind>()
  for (const tab of tabs) {
    let kind: PlaneActivityDotKind | null = null
    for (const paneId of tab.paneIds) {
      const dot = resolvePlaneActivityDot(agentPlaneStatus[paneId], {
        paneBusy: busyPanes.has(paneId),
        delegationTarget: delegationTargetPaneIds.has(paneId),
        awaitingDelegations: awaitingDelegationPaneIds.has(paneId),
      })
      if (dot === 'delegating') {
        kind = 'delegating'
        break
      }
      if (dot === 'busy') kind = 'busy'
    }
    if (kind) out.set(tab.id, kind)
  }
  return out
}
