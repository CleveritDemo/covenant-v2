/**
 * Pliega las réplicas de un experto bajo su fila base para Pulse.
 *
 * El orquestador le da a cada copia su propio `agentId` (`backend-2`), así que
 * `aggregateAgents` —que mide por instancia, y debe seguir haciéndolo: es la
 * verdad del log— las devuelve como agentes sueltos. Esto es solo la vista.
 */

import { parseExpertReplicaRequest } from './expertReplicas'
import type { PulseAgentStat } from './pulseEvents'

export interface PulseAgentGroup {
  /** Fila visible: el experto base con los totales de todas sus instancias. */
  base: PulseAgentStat
  /** Instancias que aportaron, base incluida y primera. Longitud ≥ 1. */
  instances: PulseAgentStat[]
  /**
   * Pico de instancias activas el mismo día. Es la granularidad que permite
   * `series` (turnos por día); no hay concurrencia por hora en el log.
   */
  peakSameDay: number
  /** Réplicas que gastaron turno y cerraron con cero tokens. */
  emptyReplicas: number
}

function emptyLike(id: string): PulseAgentStat {
  return {
    agentId: id,
    turns: 0,
    commits: 0,
    delegationsOut: 0,
    delegationsIn: 0,
    results: 0,
    loopTurns: 0,
    tokens: 0,
    activeDays: 0,
    avgDurationMs: 0,
    lastTs: 0,
    modes: { ask: 0, plan: 0, auto: 0, other: 0 },
    series: [],
    repos: [],
  }
}

/** Suma las instancias en una fila; conserva la identidad de la base. */
function mergeInstances(baseId: string, instances: readonly PulseAgentStat[]): PulseAgentStat {
  const seriesLength = instances.reduce((max, item) => Math.max(max, item.series.length), 0)
  const merged = emptyLike(baseId)
  merged.series = new Array(seriesLength).fill(0)

  const activeDays = new Set<number>()
  const repoTurns = new Map<string, number>()
  let durationWeighted = 0
  let durationTurns = 0

  for (const item of instances) {
    merged.turns += item.turns
    merged.commits += item.commits
    merged.delegationsOut += item.delegationsOut
    merged.delegationsIn += item.delegationsIn
    merged.results += item.results
    merged.loopTurns += item.loopTurns
    merged.tokens += item.tokens
    merged.modes.ask += item.modes.ask
    merged.modes.plan += item.modes.plan
    merged.modes.auto += item.modes.auto
    merged.modes.other += item.modes.other
    if (item.lastTs > merged.lastTs) {
      merged.lastTs = item.lastTs
      // Nombre y proveedor del último que habló, igual que hace aggregateAgents.
      if (item.provider) merged.provider = item.provider
    }
    for (let day = 0; day < item.series.length; day += 1) {
      const turns = item.series[day] ?? 0
      if (turns <= 0) continue
      merged.series[day] = (merged.series[day] ?? 0) + turns
      activeDays.add(day)
    }
    for (const entry of item.repos) {
      repoTurns.set(entry.repo, (repoTurns.get(entry.repo) ?? 0) + entry.turns)
    }
    if (item.avgDurationMs > 0 && item.turns > 0) {
      durationWeighted += item.avgDurationMs * item.turns
      durationTurns += item.turns
    }
  }

  // El nombre lo pone siempre la base: la réplica trae " (replica)" pegado.
  const base = instances.find(item => item.agentId === baseId)
  if (base?.name) merged.name = base.name
  if (base?.provider) merged.provider = base.provider

  // Fuera de la ventana de `series` no hay días que contar: caer en la suma de
  // activeDays inflaría (dos instancias el mismo día contarían dos veces).
  merged.activeDays = seriesLength > 0
    ? activeDays.size
    : Math.max(...instances.map(item => item.activeDays), 0)
  merged.avgDurationMs = durationTurns > 0 ? durationWeighted / durationTurns : 0
  merged.repos = [...repoTurns.entries()]
    .map(([repo, turns]) => ({ repo, turns }))
    .sort((a, b) => b.turns - a.turns)
  return merged
}

/** Máximo de instancias con turnos el mismo día. 1 si nunca coincidieron. */
function peakSameDayInstances(instances: readonly PulseAgentStat[]): number {
  const length = instances.reduce((max, item) => Math.max(max, item.series.length), 0)
  let peak = 0
  for (let day = 0; day < length; day += 1) {
    let active = 0
    for (const item of instances) {
      if ((item.series[day] ?? 0) > 0) active += 1
    }
    if (active > peak) peak = active
  }
  return Math.max(1, peak)
}

/**
 * Agrupa `PulseAgentStat[]` por experto, conservando el orden de entrada de las
 * bases. Una réplica solo se pliega si su base está en la lista: sin esa
 * cláusula un agente llamado `sprint-2` desaparecería dentro de un `sprint`
 * inexistente.
 */
export function foldPulseReplicas(agents: readonly PulseAgentStat[]): PulseAgentGroup[] {
  const ids = new Set(agents.map(agent => agent.agentId))

  const baseIdFor = (agentId: string): string => {
    const parsed = parseExpertReplicaRequest(agentId)
    if (!parsed.explicitReplica) return agentId
    return ids.has(parsed.baseId) ? parsed.baseId : agentId
  }

  const order: string[] = []
  const byBase = new Map<string, PulseAgentStat[]>()
  for (const agent of agents) {
    const baseId = baseIdFor(agent.agentId)
    let bucket = byBase.get(baseId)
    if (!bucket) {
      bucket = []
      byBase.set(baseId, bucket)
      order.push(baseId)
    }
    bucket.push(agent)
  }

  return order.map(baseId => {
    const bucket = byBase.get(baseId) ?? []
    // La base primero; las réplicas detrás en el orden en que llegaron.
    const instances = [
      ...bucket.filter(item => item.agentId === baseId),
      ...bucket.filter(item => item.agentId !== baseId),
    ]
    const replicas = instances.filter(item => item.agentId !== baseId)
    return {
      base: instances.length === 1 ? instances[0] : mergeInstances(baseId, instances),
      instances,
      peakSameDay: peakSameDayInstances(instances),
      emptyReplicas: replicas.filter(item => item.turns > 0 && item.tokens === 0).length,
    }
  })
}
