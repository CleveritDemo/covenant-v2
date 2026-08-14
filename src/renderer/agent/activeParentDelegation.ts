/** Hold de delegación padre por carril (paneId::threadId). */

import { DEFAULT_THREAD_ID } from '@shared/agentThreads'
import { buildRunKey } from '@shared/agentRunKey'

export interface ActiveParentDelegation {
  id: string
  fromPaneId: string
  toAgentId: string
  orchestrationJobId: string
  threadId: string
}

const byRunKey = new Map<string, ActiveParentDelegation>()

export function rememberActiveParentDelegation(
  paneId: string,
  threadId: string | undefined,
  delegation: Omit<ActiveParentDelegation, 'threadId'>,
): void {
  const resolvedThreadId = String(threadId ?? '').trim() || DEFAULT_THREAD_ID
  const key = buildRunKey(paneId, threadId)
  if (!delegation.id.trim()) return
  const orchestrationJobId = delegation.orchestrationJobId?.trim()
  if (!orchestrationJobId) return
  byRunKey.set(key, {
    id: delegation.id.trim(),
    fromPaneId: delegation.fromPaneId.trim(),
    toAgentId: delegation.toAgentId.trim(),
    orchestrationJobId,
    threadId: resolvedThreadId,
  })
}

export function peekActiveParentDelegation(
  paneId: string,
  threadId?: string,
): ActiveParentDelegation | null {
  return byRunKey.get(buildRunKey(paneId, threadId)) ?? null
}

export function clearActiveParentDelegation(
  paneId: string,
  threadId?: string,
): void {
  byRunKey.delete(buildRunKey(paneId, threadId))
}

/** Test helper: vacía el registry. */
export function resetActiveParentDelegationsForTests(): void {
  byRunKey.clear()
}
