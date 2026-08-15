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
    expect(binding?.threads.map(thread => thread.id)).toEqual(['human-1'])
  })
})
