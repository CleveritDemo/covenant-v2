/**
 * Podar hilos `origin === 'delegation'` en panes especialistas al cerrar la ola.
 */

import type { AgentChatRef } from '@shared/agentChatPersistence'
import { agentChatRefFor } from '@shared/agentChatPersistence'
import { pruneCompletedDelegationThreads, threadPatch } from '@shared/agentThreads'
import type { OrchestrationJob } from '@shared/orchestrationJobs'
import { collectDelegationThreadIdsByPaneFromJob } from '@shared/orchestrationJobs'
import { threadStateOf } from '@shared/projectAgentCatalog'
import type { TabSession } from '@shared/tabSession'

export interface DelegationThreadChatDelete {
  ref: AgentChatRef
  threadId: string
}

export function pruneDelegationThreadsByPane(
  tabs: TabSession[],
  byPane: ReadonlyMap<string, readonly string[]>,
  now = Date.now(),
  createId: () => string = () => crypto.randomUUID(),
): { tabs: TabSession[]; chatDeletes: DelegationThreadChatDelete[] } {
  if (byPane.size === 0) return { tabs, chatDeletes: [] }

  const chatDeletes: DelegationThreadChatDelete[] = []
  let changed = false
  const nextTabs = tabs.map(tab => {
    const agentByPane = { ...(tab.agentByPane ?? {}) }
    let tabChanged = false
    for (const [paneId, threadIds] of byPane) {
      if (!tab.paneIds.includes(paneId)) continue
      const binding = agentByPane[paneId]
      if (!binding) continue
      const { state, deletedIds } = pruneCompletedDelegationThreads(
        threadStateOf(binding),
        threadIds,
        createId(),
        now,
      )
      if (deletedIds.length === 0) continue
      const patched = threadPatch(state)
      const { cliSessionId: _legacySession, ...bindingRest } = binding
      agentByPane[paneId] = {
        ...bindingRest,
        threads: patched.threads,
        activeThreadId: patched.activeThreadId,
        ...(patched.cliSessionId ? { cliSessionId: patched.cliSessionId } : {}),
      }
      tabChanged = true
      const chatRef = agentChatRefFor(
        {
          ...(tab.projectFolder?.trim()
            ? { projectFolder: tab.projectFolder.trim() }
            : {}),
          ...(tab.orgWorkspace?.slug?.trim() && tab.orgWorkspace.workspaceId?.trim()
            ? {
                orgWorkspace: {
                  slug: tab.orgWorkspace.slug.trim(),
                  workspaceId: tab.orgWorkspace.workspaceId.trim(),
                },
              }
            : {}),
        },
        binding.agentId,
        paneId,
      )
      for (const deletedId of deletedIds) {
        chatDeletes.push({ ref: chatRef, threadId: deletedId })
      }
    }
    if (!tabChanged) return tab
    changed = true
    return { ...tab, agentByPane }
  })
  return { tabs: changed ? nextTabs : tabs, chatDeletes }
}

export function pruneDelegationThreadsForJob(
  tabs: TabSession[],
  job: OrchestrationJob,
  now = Date.now(),
  createId: () => string = () => crypto.randomUUID(),
): { tabs: TabSession[]; chatDeletes: DelegationThreadChatDelete[] } {
  return pruneDelegationThreadsByPane(
    tabs,
    collectDelegationThreadIdsByPaneFromJob(job),
    now,
    createId,
  )
}

export function mergeDelegationThreadIdsByPane(
  maps: ReadonlyArray<ReadonlyMap<string, readonly string[]>>,
): Map<string, string[]> {
  const merged = new Map<string, string[]>()
  for (const map of maps) {
    for (const [paneId, threadIds] of map) {
      const list = merged.get(paneId) ?? []
      for (const threadId of threadIds) {
        if (!list.includes(threadId)) list.push(threadId)
      }
      merged.set(paneId, list)
    }
  }
  return merged
}
