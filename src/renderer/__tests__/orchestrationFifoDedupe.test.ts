import { describe, expect, it } from 'vitest'
import { isDuplicateOrchestrationQueueItem } from '../../shared/agentOrchestration'

type QueueItem = {
  text: string
  orchestrationJobId?: string
  delegation?: { id: string }
}

type EnqueuePayload = {
  text: string
  orchestrationJobId?: string
  delegation?: { id: string }
}

/** Réplica del guard de dedupe por texto en App.tsx enqueueOrchestrationSend. */
function shouldRejectAsDuplicateText(
  queue: QueueItem[],
  payload: EnqueuePayload,
): boolean {
  if (payload.delegation) return false
  const nextItem = {
    text: payload.text,
    orchestrationJobId: payload.orchestrationJobId?.trim(),
  }
  return queue.some(item => isDuplicateOrchestrationQueueItem(item, nextItem))
}

function simulateOrchestrationEnqueue(
  queue: QueueItem[],
  payload: EnqueuePayload,
): QueueItem[] {
  if (shouldRejectAsDuplicateText(queue, payload)) return queue
  return [
    ...queue,
    {
      text: payload.text,
      orchestrationJobId: payload.orchestrationJobId?.trim(),
      ...(payload.delegation ? { delegation: payload.delegation } : {}),
    },
  ]
}

describe('orchestration FIFO text dedupe (App.tsx contract)', () => {
  it('allows two delegations with identical text to the same pane', () => {
    const text = 'Review the auth module'
    let queue: QueueItem[] = []
    queue = simulateOrchestrationEnqueue(queue, {
      text,
      delegation: { id: 'delegation-a' },
    })
    queue = simulateOrchestrationEnqueue(queue, {
      text,
      delegation: { id: 'delegation-b' },
    })
    expect(queue).toHaveLength(2)
    expect(queue.map(item => item.delegation?.id)).toEqual(['delegation-a', 'delegation-b'])
  })

  it('dedupes two identical follow-ups from the same job to one queue item', () => {
    const followUp = {
      text: '## Delegation result\nSpecialist finished.',
      orchestrationJobId: 'job-orch-1',
    }
    let queue: QueueItem[] = []
    queue = simulateOrchestrationEnqueue(queue, followUp)
    queue = simulateOrchestrationEnqueue(queue, followUp)
    expect(queue).toHaveLength(1)
  })
})
