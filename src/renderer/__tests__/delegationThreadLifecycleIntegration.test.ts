import { describe, expect, it } from 'vitest'
import {
  pruneCompletedDelegationThreads,
  sanitizeThreadState,
} from '@shared/agentThreads'
import {
  appendLaneText,
  getLane,
  startLane,
} from '../agent/paneThreadLanes'

function delegationResultSummary(content: string, emptyFallback: string): string {
  return content.trim() || emptyFallback
}

describe('delegation thread lifecycle integration', () => {
  it('al cerrar el job, los hilos de delegación desaparecen del pane y los humanos siguen', () => {
    const state = sanitizeThreadState(
      [
        { id: 'human-main', title: 'feature', updatedAt: 200, origin: 'human' },
        { id: 'del-thread', title: 'deleg', updatedAt: 100, origin: 'delegation', delegationId: 'd-1' },
      ],
      'human-main',
    )
    const { state: next, deletedIds } = pruneCompletedDelegationThreads(
      state,
      ['del-thread'],
      'fallback-thread',
      300,
    )
    expect(deletedIds).toEqual(['del-thread'])
    expect(next.threads.map(thread => thread.id)).toEqual(['human-main'])
    expect(next.threads.every(thread => thread.origin !== 'delegation')).toBe(true)
  })

  it('si el hilo de delegación era el activo, el pane queda en un hilo humano no vacío', () => {
    const state = sanitizeThreadState(
      [
        { id: 'human-new', title: 'latest', updatedAt: 300, origin: 'human' },
        { id: 'human-old', title: 'older', updatedAt: 100, origin: 'human' },
        { id: 'del-active', title: 'deleg', updatedAt: 200, origin: 'delegation' },
      ],
      'del-active',
    )
    const { state: next } = pruneCompletedDelegationThreads(
      state,
      ['del-active'],
      'fallback-thread',
      400,
    )
    expect(next.activeThreadId).toBe('human-new')
    expect(next.threads.length).toBeGreaterThan(0)
    expect(next.threads.some(thread => thread.id === 'del-active')).toBe(false)
  })

  it('promover a carril conserva el stream del turno anterior sin abortar', () => {
    const threadId = 'live-thread'
    const assistantId = 'assistant-live'
    const lanes = startLane(new Map(), {
      threadId,
      delegationId: '',
      assistantId,
      messages: [
        { id: 'user-1', role: 'user', content: 'sigue escribiendo' },
        { id: assistantId, role: 'assistant', content: '' },
      ],
    })
    const withDelta = appendLaneText(lanes, threadId, 'texto parcial del turno en curso')
    const lane = getLane(withDelta, threadId)
    expect(lane?.busy).toBe(true)
    expect(lane?.messages[1]?.content).toBe('texto parcial del turno en curso')
  })

  it('el summary al orquestador conserva texto de más de 500 caracteres completo', () => {
    const longText = 'x'.repeat(1200)
    expect(delegationResultSummary(longText, '(vacío)')).toHaveLength(1200)
    expect(delegationResultSummary('   ', '(vacío)')).toBe('(vacío)')
  })
})
