import { describe, expect, it } from 'vitest'
import type { DelegateRequest } from '@shared/agentOrchestration'
import type { OrchestrationAgentRef } from '@shared/agentOrchestration'
import {
  MAX_LANES_PER_PANE,
  resolveDelegationLane,
} from '@shared/delegationLanes'
import {
  createOrchestrationJob,
  upsertOrchestrationWaveItem,
  type OrchestrationJob,
} from '@shared/orchestrationJobs'

const TARGETS: OrchestrationAgentRef[] = [
  { paneId: 'pane-fe', agentId: 'frontend', name: 'Frontend' },
]

function countActiveLanesByPane(
  jobsByPane: Map<string, Map<string, OrchestrationJob>>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const jobsMap of jobsByPane.values()) {
    for (const job of jobsMap.values()) {
      for (const meta of job.pending.values()) {
        map.set(meta.toPaneId, (map.get(meta.toPaneId) ?? 0) + 1)
      }
    }
  }
  return map
}

type LaneRouteResult =
  | { kind: 'lane'; paneId: string; agentId: string; threadId: string }
  | { kind: 'defer'; paneId: string; agentId: string }
  | { kind: 'fail' }

/**
 * Simula el enrutamiento por carril de handleOrchestratorDelegations sin spawn
 * de réplicas ni IPC (upsertProjectAgent / setTabs).
 */
function routeDelegationsToLanes(input: {
  delegations: DelegateRequest[]
  initialPaneCount?: number
  jobsByPane?: Map<string, Map<string, OrchestrationJob>>
}): {
  results: LaneRouteResult[]
  job: OrchestrationJob
  paneCount: number
  catalogWrites: number
} {
  const job = createOrchestrationJob('p-orq')
  const jobsByPane = input.jobsByPane ?? new Map([['p-orq', new Map([[job.jobId, job]])]])
  const jobsMap = jobsByPane.get('p-orq')!
  let paneCount = input.initialPaneCount ?? TARGETS.length
  let catalogWrites = 0
  const results: LaneRouteResult[] = []

  for (const delegation of input.delegations) {
    const decision = resolveDelegationLane({
      toAgentId: delegation.toAgentId,
      targets: TARGETS,
      activeLanesByPane: countActiveLanesByPane(jobsByPane),
    })

    if (decision.kind === 'fail') {
      results.push({ kind: 'fail' })
      continue
    }

    if (decision.kind === 'defer') {
      job.deferred.push({
        tabId: 'tab-1',
        delegation,
        toPaneId: decision.paneId,
        toAgentId: decision.agentId,
      })
      upsertOrchestrationWaveItem(job, {
        delegationId: delegation.id,
        toAgentId: decision.agentId,
        toPaneId: decision.paneId,
        status: 'deferred',
      })
      results.push({
        kind: 'defer',
        paneId: decision.paneId,
        agentId: decision.agentId,
      })
      continue
    }

    const threadId = `thread-${delegation.id}`
    job.pending.set(delegation.id, {
      toPaneId: decision.paneId,
      toAgentId: decision.agentId,
      toThreadId: threadId,
      startedAt: Date.now(),
    })
    upsertOrchestrationWaveItem(job, {
      delegationId: delegation.id,
      toAgentId: decision.agentId,
      toPaneId: decision.paneId,
      toThreadId: threadId,
      status: 'running',
    })
    results.push({
      kind: 'lane',
      paneId: decision.paneId,
      agentId: decision.agentId,
      threadId,
    })
  }

  return { results, job, paneCount, catalogWrites }
}

describe('delegación por carriles de hilo (sin réplicas)', () => {
  it('dos delegaciones seguidas al mismo agentId usan dos toThreadId distintos en el mismo toPaneId', () => {
    const { results, job } = routeDelegationsToLanes({
      delegations: [
        { id: 'd1', toAgentId: 'frontend', objective: 'first' },
        { id: 'd2', toAgentId: 'frontend', objective: 'second' },
      ],
    })

    const lanes = results.filter((item): item is Extract<LaneRouteResult, { kind: 'lane' }> => item.kind === 'lane')
    expect(lanes).toHaveLength(2)
    expect(lanes[0].paneId).toBe('pane-fe')
    expect(lanes[1].paneId).toBe('pane-fe')
    expect(lanes[0].threadId).not.toBe(lanes[1].threadId)

    const pending = [...job.pending.values()]
    expect(pending).toHaveLength(2)
    expect(pending.every(meta => meta.toPaneId === 'pane-fe')).toBe(true)
    expect(new Set(pending.map(meta => meta.toThreadId)).size).toBe(2)
  })

  it('la tercera delegación al mismo experto cae a deferred cuando el cap de carriles está lleno', () => {
    const delegations = Array.from({ length: MAX_LANES_PER_PANE + 1 }, (_, index) => ({
      id: `d${index + 1}`,
      toAgentId: 'frontend',
      objective: `task ${index + 1}`,
    }))

    const { results, job } = routeDelegationsToLanes({ delegations })

    const lanes = results.filter(item => item.kind === 'lane')
    const deferred = results.filter(item => item.kind === 'defer')
    expect(lanes).toHaveLength(MAX_LANES_PER_PANE)
    expect(deferred).toHaveLength(1)
    expect(job.pending.size).toBe(MAX_LANES_PER_PANE)
    expect(job.deferred).toHaveLength(1)
    expect(job.deferred[0].toPaneId).toBe('pane-fe')
  })

  it('no crea panes nuevos ni escribe en el catálogo de agentes', () => {
    const { paneCount, catalogWrites, results } = routeDelegationsToLanes({
      delegations: [
        { id: 'd1', toAgentId: 'frontend', objective: 'a' },
        { id: 'd2', toAgentId: 'frontend', objective: 'b' },
        { id: 'd3', toAgentId: 'frontend', objective: 'c' },
        { id: 'd4', toAgentId: 'frontend', objective: 'd' },
      ],
      initialPaneCount: 1,
    })

    expect(paneCount).toBe(1)
    expect(catalogWrites).toBe(0)
    expect(results.every(item => item.kind === 'lane' || item.kind === 'defer')).toBe(true)
    expect(results.some(item => item.kind === 'fail')).toBe(false)
  })

  it('dos orquestadores distintos respetan el tope global de 3 carriles en el mismo experto', () => {
    const jobsByPane = new Map<string, Map<string, OrchestrationJob>>()
    const jobA = createOrchestrationJob('p-orq-a')
    const jobB = createOrchestrationJob('p-orq-b')
    jobsByPane.set('p-orq-a', new Map([[jobA.jobId, jobA]]))
    jobsByPane.set('p-orq-b', new Map([[jobB.jobId, jobB]]))

    const routeOne = (fromPaneId: string, delegation: DelegateRequest) => {
      const jobsMap = jobsByPane.get(fromPaneId)!
      const job = [...jobsMap.values()][0]!
      const decision = resolveDelegationLane({
        toAgentId: delegation.toAgentId,
        targets: TARGETS,
        activeLanesByPane: countActiveLanesByPane(jobsByPane),
      })
      if (decision.kind !== 'lane') return decision.kind
      const threadId = `thread-${delegation.id}`
      job.pending.set(delegation.id, {
        toPaneId: decision.paneId,
        toAgentId: decision.agentId,
        toThreadId: threadId,
        startedAt: Date.now(),
      })
      return 'lane'
    }

    expect(routeOne('p-orq-a', { id: 'd1', toAgentId: 'frontend', objective: 'a' })).toBe('lane')
    expect(routeOne('p-orq-a', { id: 'd2', toAgentId: 'frontend', objective: 'b' })).toBe('lane')
    expect(routeOne('p-orq-b', { id: 'd3', toAgentId: 'frontend', objective: 'c' })).toBe('lane')
    expect(routeOne('p-orq-b', { id: 'd4', toAgentId: 'frontend', objective: 'd' })).toBe('defer')
    expect(countActiveLanesByPane(jobsByPane).get('pane-fe')).toBe(MAX_LANES_PER_PANE)
  })
})
