/** Paso de una cadena de loops (un turno de chat por agente). */
import { LOOP_INTERVAL_PRESETS } from './agentLoop'

export interface PlaneLoopStep {
  paneId: string
  objective: string
}

export type PlaneLoopChainStatus = 'idle' | 'running' | 'waiting' | 'stopped'

/**
 * Cadena ordenada A→B→C…; al terminar el último paso espera `intervalMs`
 * y reinicia desde el primero.
 */
export interface PlaneLoopChain {
  id: string
  steps: PlaneLoopStep[]
  /** Espera entre ciclos; mismos presets que el loop del chat. */
  intervalMs: number
  status: PlaneLoopChainStatus
  /** Índice del paso en curso (o del próximo al reanudar). */
  cursor: number
}

const DEFAULT_INTERVAL_MS = LOOP_INTERVAL_PRESETS[0].ms

function newChainId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `chain-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Encaja al preset de intervalo del loop de chat más cercano. */
export function clampLoopChainIntervalMs(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_INTERVAL_MS
  let best = LOOP_INTERVAL_PRESETS[0]
  let bestDist = Number.POSITIVE_INFINITY
  for (const preset of LOOP_INTERVAL_PRESETS) {
    const dist = Math.abs(preset.ms - value)
    if (dist < bestDist) {
      best = preset
      bestDist = dist
    }
  }
  return best.ms
}

export function defaultLoopChainIntervalMs(): number {
  return DEFAULT_INTERVAL_MS
}

/** paneIds de cadenas running/waiting (loop “encendido” en chat). */
export function activeLoopChainPaneIds(
  chains: readonly PlaneLoopChain[],
): Set<string> {
  const ids = new Set<string>()
  for (const chain of chains) {
    if (chain.status !== 'running' && chain.status !== 'waiting') continue
    for (const step of chain.steps) ids.add(step.paneId)
  }
  return ids
}

/** paneIds ya usados en la cadena (únicos). */
export function loopChainPaneIds(chain: Pick<PlaneLoopChain, 'steps'>): string[] {
  return chain.steps.map(step => step.paneId)
}

/** paneIds presentes en cualquier cadena (un agente = una sola cadena). */
export function paneIdsUsedInLoopChains(
  chains: readonly PlaneLoopChain[],
  exceptChainId?: string,
): Set<string> {
  const ids = new Set<string>()
  for (const chain of chains) {
    if (exceptChainId && chain.id === exceptChainId) continue
    for (const step of chain.steps) ids.add(step.paneId)
  }
  return ids
}

export function chainHasPane(
  chain: Pick<PlaneLoopChain, 'steps'>,
  paneId: string,
): boolean {
  return chain.steps.some(step => step.paneId === paneId)
}

export function canAppendLoopStep(
  chain: Pick<PlaneLoopChain, 'steps'>,
  paneId: string,
): boolean {
  const id = paneId.trim()
  if (!id) return false
  return !chainHasPane(chain, id)
}

export function createLoopChain(
  paneId: string,
  objective: string,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): PlaneLoopChain | null {
  const id = paneId.trim()
  const text = objective.trim()
  if (!id || !text) return null
  return {
    id: newChainId(),
    steps: [{ paneId: id, objective: text }],
    intervalMs: clampLoopChainIntervalMs(intervalMs),
    status: 'idle',
    cursor: 0,
  }
}

export function appendLoopStep(
  chain: PlaneLoopChain,
  paneId: string,
  objective: string,
): PlaneLoopChain | null {
  const id = paneId.trim()
  const text = objective.trim()
  if (!id || !text || !canAppendLoopStep(chain, id)) return null
  return {
    ...chain,
    steps: [...chain.steps, { paneId: id, objective: text }],
  }
}

/** Quita pasos de paneles inexistentes; descarta cadenas vacías. */
export function sanitizePlaneLoopChains(
  chains: unknown,
  agentPaneIds: ReadonlySet<string>,
): PlaneLoopChain[] {
  if (!Array.isArray(chains)) return []
  const result: PlaneLoopChain[] = []
  const seenIds = new Set<string>()
  /** Un agente solo puede pertenecer a una cadena. */
  const panesClaimed = new Set<string>()

  for (const raw of chains) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : newChainId()
    if (seenIds.has(id)) continue

    const rawSteps = Array.isArray(item.steps) ? item.steps : []
    const steps: PlaneLoopStep[] = []
    const usedPanes = new Set<string>()
    for (const rawStep of rawSteps) {
      if (!rawStep || typeof rawStep !== 'object') continue
      const step = rawStep as Record<string, unknown>
      const paneId = typeof step.paneId === 'string' ? step.paneId.trim() : ''
      const objective = typeof step.objective === 'string' ? step.objective.trim() : ''
      if (!paneId || !objective || !agentPaneIds.has(paneId)) continue
      if (usedPanes.has(paneId) || panesClaimed.has(paneId)) continue
      usedPanes.add(paneId)
      panesClaimed.add(paneId)
      steps.push({ paneId, objective })
    }
    if (steps.length === 0) continue

    const intervalMs = clampLoopChainIntervalMs(
      typeof item.intervalMs === 'number' ? item.intervalMs : DEFAULT_INTERVAL_MS,
    )

    // Tras reload no reanudar mid-flight: idle + cursor 0.
    const status: PlaneLoopChainStatus = 'idle'
    const cursor = 0

    seenIds.add(id)
    result.push({ id, steps, intervalMs, status, cursor })
  }
  return result
}

/**
 * Snapshot para session.json: solo configuración (pasos + intervalo).
 * Nunca persiste running/waiting ni el cursor de ejecución.
 */
export function planeLoopChainsForPersist(
  chains: readonly PlaneLoopChain[] | undefined,
): PlaneLoopChain[] | undefined {
  if (!chains?.length) return undefined
  const next = chains.map(chain => ({
    id: chain.id,
    steps: chain.steps.map(step => ({
      paneId: step.paneId,
      objective: step.objective,
    })),
    intervalMs: clampLoopChainIntervalMs(chain.intervalMs),
    status: 'idle' as const,
    cursor: 0,
  }))
  return next.length ? next : undefined
}

/** Filtra cadenas/pasos al cerrar un panel de agente. */
export function removePaneFromLoopChains(
  chains: readonly PlaneLoopChain[],
  paneId: string,
): PlaneLoopChain[] {
  const next: PlaneLoopChain[] = []
  for (const chain of chains) {
    const removedIndex = chain.steps.findIndex(step => step.paneId === paneId)
    const steps = chain.steps.filter(step => step.paneId !== paneId)
    if (steps.length === 0) continue
    let cursor = chain.cursor
    if (removedIndex >= 0 && removedIndex < cursor) cursor -= 1
    if (cursor < 0 || cursor >= steps.length) cursor = 0
    const status: PlaneLoopChainStatus =
      chain.status === 'running' || chain.status === 'waiting'
        ? 'stopped'
        : chain.status
    next.push({ ...chain, steps, cursor, status })
  }
  return next
}
