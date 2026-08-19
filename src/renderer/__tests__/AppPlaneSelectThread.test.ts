/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { createOrchestrationJob } from '../../shared/orchestrationJobs'
import type { AgentPaneMeta } from '../../shared/tabSession'
import { applyPlaneSelectThreadMeta } from '../App'

const baseMeta: AgentPaneMeta = {
  id: 'frontend',
  name: 'David',
  provider: 'claude',
  threads: [{ id: 't-human', title: 'Hola', updatedAt: 100 }],
  activeThreadId: 't-human',
}

function jobsWithPending(
  paneId: string,
  threadId: string,
  delegationId = 'd-1',
): Map<string, Map<string, ReturnType<typeof createOrchestrationJob>>> {
  const job = createOrchestrationJob('orch-1')
  job.pending.set(delegationId, {
    toPaneId: paneId,
    toAgentId: 'frontend',
    toThreadId: threadId,
  })
  return new Map([['orch-1', new Map([['job-1', job]])]])
}

describe('applyPlaneSelectThreadMeta', () => {
  it('registra un hilo pendiente no catalogado con origin delegation y lo activa', () => {
    const paneId = 'pane-fe'
    const threadId = 'lane-1'
    const now = 1_700_000_000_000
    const next = applyPlaneSelectThreadMeta(
      baseMeta,
      paneId,
      threadId,
      now,
      jobsWithPending(paneId, threadId),
    )

    expect(next.threads).toEqual([
      { id: 't-human', title: 'Hola', updatedAt: 100 },
      {
        id: threadId,
        title: '',
        updatedAt: now,
        origin: 'delegation',
        delegationId: 'd-1',
      },
    ])
    expect(next.activeThreadId).toBe(threadId)
  })

  it('no muta el catálogo si el hilo es desconocido y no hay pending', () => {
    const next = applyPlaneSelectThreadMeta(
      baseMeta,
      'pane-fe',
      'lane-missing',
      1_700_000_000_000,
      new Map(),
    )

    expect(next.threads).toEqual(baseMeta.threads)
    expect(next.activeThreadId).toBe(baseMeta.activeThreadId)
  })

  it('se comporta igual que hoy al seleccionar un hilo ya catalogado', () => {
    const now = 1_700_000_000_111
    const next = applyPlaneSelectThreadMeta(
      baseMeta,
      'pane-fe',
      't-human',
      now,
      new Map(),
    )

    expect(next.threads).toEqual([
      { id: 't-human', title: 'Hola', updatedAt: now },
    ])
    expect(next.activeThreadId).toBe('t-human')
  })
})
