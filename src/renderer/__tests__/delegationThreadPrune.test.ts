import { describe, expect, it } from 'vitest'
import { sanitizeThreadState } from '@shared/agentThreads'
import { createOrchestrationJob } from '@shared/orchestrationJobs'
import type { TabSession } from '@shared/tabSession'
import { pruneDelegationThreadsForJob } from '../delegationThreadPrune'

function tabWithDelegationThread(
  paneId: string,
  agentId: string,
  threadId: string,
): TabSession {
  return {
    id: 'tab-1',
    title: 'Tab',
    paneIds: [paneId],
    agentByPane: {
      [paneId]: {
        agentId,
        threads: sanitizeThreadState(
          [
            { id: 'human-1', title: 'main', updatedAt: 100, origin: 'human' },
            { id: threadId, title: 'deleg', updatedAt: 50, origin: 'delegation', delegationId: 'd-1' },
          ],
          'human-1',
        ).threads,
        activeThreadId: 'human-1',
      },
    },
  }
}

function jobWithDelegationThread(paneId: string, threadId: string) {
  const job = createOrchestrationJob('orch', 'job-a')
  job.pending.set('d-1', {
    toPaneId: paneId,
    toAgentId: 'frontend',
    toThreadId: threadId,
  })
  job.waveItems.push({
    delegationId: 'd-1',
    toAgentId: 'frontend',
    toPaneId: paneId,
    toThreadId: threadId,
    status: 'running',
  })
  return job
}

describe('pruneDelegationThreadsForJob', () => {
  it('podaría hilos pending del job (misma ruta que Stop total y cierre de ola)', () => {
    const job = createOrchestrationJob('orch', 'job-a')
    job.pending.set('d-1', {
      toPaneId: 'pane-fe',
      toAgentId: 'frontend',
      toThreadId: 'del-thread',
    })
    job.waveItems.push({
      delegationId: 'd-1',
      toAgentId: 'frontend',
      toPaneId: 'pane-fe',
      toThreadId: 'del-thread',
      status: 'running',
    })

    const tabs = [tabWithDelegationThread('pane-fe', 'frontend', 'del-thread')]
    const { tabs: nextTabs, chatDeletes } = pruneDelegationThreadsForJob(
      tabs,
      job,
      200,
      () => 'fallback',
    )

    expect(chatDeletes).toHaveLength(1)
    expect(chatDeletes[0]?.threadId).toBe('del-thread')
    expect(chatDeletes[0]?.ref.storageKey).toBeTruthy()
    const binding = nextTabs[0]?.agentByPane?.['pane-fe']
    expect(binding?.threads?.map(thread => thread.id)).toEqual(['human-1'])
  })

  it('no poda un hilo cuyo carril el pane sigue reportando vivo', () => {
    const tabs = [tabWithDelegationThread('pane-fe', 'frontend', 'del-thread')]
    const { tabs: nextTabs, chatDeletes } = pruneDelegationThreadsForJob(
      tabs,
      jobWithDelegationThread('pane-fe', 'del-thread'),
      200,
      () => 'fallback',
      new Map([['pane-fe', new Set(['del-thread'])]]),
    )

    expect(chatDeletes).toEqual([])
    // Misma referencia: sin poda no hay setTabs ni re-render.
    expect(nextTabs).toBe(tabs)
    const binding = nextTabs[0]?.agentByPane?.['pane-fe']
    expect(binding?.threads?.map(thread => thread.id)).toEqual(['human-1', 'del-thread'])
  })

  it('poda los hilos cerrados aunque otro del mismo pane siga vivo', () => {
    const tab = tabWithDelegationThread('pane-fe', 'frontend', 'del-thread')
    const binding = tab.agentByPane!['pane-fe']!
    tab.agentByPane!['pane-fe'] = {
      ...binding,
      threads: [
        ...(binding.threads ?? []),
        { id: 'del-vivo', title: 'deleg 2', updatedAt: 60, origin: 'delegation', delegationId: 'd-2' },
      ],
    }
    const job = jobWithDelegationThread('pane-fe', 'del-thread')
    job.pending.set('d-2', {
      toPaneId: 'pane-fe',
      toAgentId: 'frontend',
      toThreadId: 'del-vivo',
    })

    const { tabs: nextTabs, chatDeletes } = pruneDelegationThreadsForJob(
      [tab],
      job,
      200,
      () => 'fallback',
      new Map([['pane-fe', new Set(['del-vivo'])]]),
    )

    expect(chatDeletes.map(item => item.threadId)).toEqual(['del-thread'])
    const next = nextTabs[0]?.agentByPane?.['pane-fe']
    expect(next?.threads?.map(thread => thread.id)).toEqual(['human-1', 'del-vivo'])
  })

  it('un pane vivo no protege los hilos de otro pane', () => {
    const tabs = [tabWithDelegationThread('pane-fe', 'frontend', 'del-thread')]
    const { chatDeletes } = pruneDelegationThreadsForJob(
      tabs,
      jobWithDelegationThread('pane-fe', 'del-thread'),
      200,
      () => 'fallback',
      new Map([['pane-be', new Set(['del-thread'])]]),
    )

    expect(chatDeletes.map(item => item.threadId)).toEqual(['del-thread'])
  })

  it('un mapa de vivos vacío no cambia nada', () => {
    const tabs = [tabWithDelegationThread('pane-fe', 'frontend', 'del-thread')]
    const { chatDeletes } = pruneDelegationThreadsForJob(
      tabs,
      jobWithDelegationThread('pane-fe', 'del-thread'),
      200,
      () => 'fallback',
      new Map(),
    )

    expect(chatDeletes.map(item => item.threadId)).toEqual(['del-thread'])
  })
})
