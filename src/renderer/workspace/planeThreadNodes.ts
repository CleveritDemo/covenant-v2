import type { OrchestrationAwaitingView } from '@shared/orchestrationAwaiting'
import type { PlaneBusyDotVariant } from '../components/ui/PlaneBusyDot'

/**
 * Filas de hilo de la card mini de un agente.
 *
 * La regla es que el listado muestre **todo lo que corre**: turno humano y
 * carriles de delegación por igual. Por eso no se puede armar mapeando el
 * catálogo de threads y filtrando por running: un carril entra en el mapa de
 * hilos activos en cuanto el orquestador despacha la subtarea (con su
 * `toThreadId`), y el pane solo lo registra en el catálogo cuando arranca el
 * turno. En esa ventana —y en cualquier hilo que la poda del tope haya sacado
 * del catálogo mientras seguía vivo— la fila desaparecía y la card se quedaba
 * mostrando el snippet, sin ninguna señal de trabajo.
 *
 * Orquestador en ola: **una** fila agregada de delegación va **antes** que los
 * hilos busy del propio pane (`mergePlaneMiniThreadRows`).
 */
export interface PlaneThreadNodeInput {
  id: string
  title: string
}

export type PlaneMiniRowKind = 'thread' | 'delegation'

export interface PlaneThreadNodeData {
  id: string
  title: string
  running: boolean
  activity: string
  kind?: PlaneMiniRowKind
  dotVariant?: PlaneBusyDotVariant
}

export interface DelegationMiniNodeLabels {
  delegatingTitle: string
  waveProgress: (done: number, total: number) => string
}

/** Una sola fila agregada de ola en la mini del orquestador (no una por delegación). */
export function buildDelegationMiniNodes(
  view: OrchestrationAwaitingView | null | undefined,
  labels: DelegationMiniNodeLabels,
): PlaneThreadNodeData[] {
  if (!view?.items.length) return []
  const pending = view.items.filter(item => item.status !== 'done')
  if (pending.length === 0) return []

  const hasRunning = pending.some(item => item.status === 'running')
  return [{
    id: 'delegation:wave',
    title: labels.delegatingTitle,
    running: true,
    activity: labels.waveProgress(view.done, view.total),
    kind: 'delegation' as const,
    dotVariant: hasRunning ? 'delegating' : 'deferred',
  }]
}

/** Delegaciones primero; luego hilos busy del pane (orden del catálogo + extras). */
export function mergePlaneMiniThreadRows(
  delegations: readonly PlaneThreadNodeData[],
  threads: readonly PlaneThreadNodeData[],
): PlaneThreadNodeData[] {
  const busyThreads = threads.filter(thread => thread.running)
  return [...delegations, ...busyThreads]
}

export function buildPlaneThreadNodes(
  catalogThreads: readonly PlaneThreadNodeInput[],
  runningThreadIds: ReadonlySet<string> | undefined,
  activities: Record<string, string> | undefined,
): PlaneThreadNodeData[] {
  const running = runningThreadIds ?? new Set<string>()
  const known = new Set(catalogThreads.map(thread => thread.id))
  const nodes: PlaneThreadNodeData[] = catalogThreads.map(thread => ({
    id: thread.id,
    title: thread.title,
    running: running.has(thread.id),
    activity: activities?.[thread.id] ?? '',
  }))
  // Hilos vivos que el catálogo todavía no tiene: van al final, en el orden en
  // que se despacharon.
  for (const threadId of running) {
    if (known.has(threadId)) continue
    nodes.push({
      id: threadId,
      title: '',
      running: true,
      activity: activities?.[threadId] ?? '',
    })
  }
  return nodes
}
