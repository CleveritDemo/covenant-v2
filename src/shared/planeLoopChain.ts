/** Paso de una cadena de loops (un turno de chat por agente). */
import { LOOP_INTERVAL_PRESETS } from './agentLoop'

export interface PlaneLoopStep {
  agentId: string
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

/** agentIds de cadenas running/waiting (loop “encendido” en chat). */
export function activeLoopChainAgentIds(
  chains: readonly PlaneLoopChain[],
): Set<string> {
  const ids = new Set<string>()
  for (const chain of chains) {
    if (chain.status !== 'running' && chain.status !== 'waiting') continue
    for (const step of chain.steps) ids.add(step.agentId)
  }
  return ids
}

/** agentIds presentes en cualquier cadena (un agente = una sola cadena). */
export function agentIdsUsedInLoopChains(
  chains: readonly PlaneLoopChain[],
  exceptChainId?: string,
): Set<string> {
  const ids = new Set<string>()
  for (const chain of chains) {
    if (exceptChainId && chain.id === exceptChainId) continue
    for (const step of chain.steps) ids.add(step.agentId)
  }
  return ids
}

export function chainHasAgent(
  chain: Pick<PlaneLoopChain, 'steps'>,
  agentId: string,
): boolean {
  return chain.steps.some(step => step.agentId === agentId)
}

export function canAppendLoopStep(
  chain: Pick<PlaneLoopChain, 'steps'>,
  agentId: string,
): boolean {
  const id = agentId.trim()
  if (!id) return false
  return !chainHasAgent(chain, id)
}

export function createLoopChain(
  agentId: string,
  objective: string,
  intervalMs: number = DEFAULT_INTERVAL_MS,
): PlaneLoopChain | null {
  const id = agentId.trim()
  const text = objective.trim()
  if (!id || !text) return null
  return {
    id: newChainId(),
    steps: [{ agentId: id, objective: text }],
    intervalMs: clampLoopChainIntervalMs(intervalMs),
    status: 'idle',
    cursor: 0,
  }
}

export function appendLoopStep(
  chain: PlaneLoopChain,
  agentId: string,
  objective: string,
): PlaneLoopChain | null {
  const id = agentId.trim()
  const text = objective.trim()
  if (!id || !text || !canAppendLoopStep(chain, id)) return null
  return {
    ...chain,
    steps: [...chain.steps, { agentId: id, objective: text }],
  }
}

/**
 * Reordena un paso dentro de la cadena (drag de la pista).
 * Índices fuera de rango o iguales → la misma cadena.
 * ponytail: no toca el cursor; la UI solo permite reordenar cadenas detenidas.
 */
export function moveLoopStep(
  chain: PlaneLoopChain,
  from: number,
  to: number,
): PlaneLoopChain {
  const last = chain.steps.length - 1
  if (from < 0 || from > last || to < 0 || to > last || from === to) return chain
  const steps = [...chain.steps]
  const [moved] = steps.splice(from, 1)
  steps.splice(to, 0, moved!)
  return { ...chain, steps }
}

/** Actualiza la interacción de un paso (edición en línea en la pista). */
export function setLoopStepObjective(
  chain: PlaneLoopChain,
  agentId: string,
  objective: string,
): PlaneLoopChain {
  const text = objective.trim()
  if (!text) return chain
  return {
    ...chain,
    steps: chain.steps.map(step => (
      step.agentId === agentId ? { ...step, objective: text } : step
    )),
  }
}

function resolveStepAgentId(
  step: Record<string, unknown>,
  agentIds: ReadonlySet<string>,
  paneIdToAgentId: Record<string, string>,
): string {
  const direct = typeof step.agentId === 'string' ? step.agentId.trim() : ''
  if (direct && agentIds.has(direct)) return direct
  const legacyPane = typeof step.paneId === 'string' ? step.paneId.trim() : ''
  if (!legacyPane) return ''
  const mapped = paneIdToAgentId[legacyPane]?.trim() ?? ''
  return mapped && agentIds.has(mapped) ? mapped : ''
}

/** Quita pasos de agentes inexistentes; descarta cadenas vacías. */
export function sanitizePlaneLoopChains(
  chains: unknown,
  agentIds: ReadonlySet<string>,
  paneIdToAgentId: Record<string, string> = {},
): PlaneLoopChain[] {
  if (!Array.isArray(chains)) return []
  const result: PlaneLoopChain[] = []
  const seenIds = new Set<string>()
  /** Un agente solo puede pertenecer a una cadena. */
  const agentsClaimed = new Set<string>()

  for (const raw of chains) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : newChainId()
    if (seenIds.has(id)) continue

    const rawSteps = Array.isArray(item.steps) ? item.steps : []
    const steps: PlaneLoopStep[] = []
    const usedAgents = new Set<string>()
    for (const rawStep of rawSteps) {
      if (!rawStep || typeof rawStep !== 'object') continue
      const step = rawStep as Record<string, unknown>
      const agentId = resolveStepAgentId(step, agentIds, paneIdToAgentId)
      const objective = typeof step.objective === 'string' ? step.objective.trim() : ''
      if (!agentId || !objective) continue
      if (usedAgents.has(agentId) || agentsClaimed.has(agentId)) continue
      usedAgents.add(agentId)
      agentsClaimed.add(agentId)
      steps.push({ agentId, objective })
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
      agentId: step.agentId,
      objective: step.objective,
    })),
    intervalMs: clampLoopChainIntervalMs(chain.intervalMs),
    status: 'idle' as const,
    cursor: 0,
  }))
  return next.length ? next : undefined
}

/** Filtra cadenas/pasos al cerrar un agente del catálogo. */
export function removeAgentFromLoopChains(
  chains: readonly PlaneLoopChain[],
  agentId: string,
): PlaneLoopChain[] {
  const next: PlaneLoopChain[] = []
  for (const chain of chains) {
    const removedIndex = chain.steps.findIndex(step => step.agentId === agentId)
    const steps = chain.steps.filter(step => step.agentId !== agentId)
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
