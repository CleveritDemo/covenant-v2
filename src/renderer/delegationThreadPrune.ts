/**
 * Podar hilos `origin === 'delegation'` en panes especialistas al cerrar la ola.
 */

import type { AgentChatRef } from '@shared/agentChatPersistence'
import { agentChatRefFor } from '@shared/agentChatPersistence'
import {
  delegationThreadIdsForDelegationIds,
  pruneCompletedDelegationThreads,
  threadPatch,
} from '@shared/agentThreads'
import type { OrchestrationJob } from '@shared/orchestrationJobs'
import { collectDelegationThreadIdsByPaneFromJob } from '@shared/orchestrationJobs'
import { threadStateOf } from '@shared/projectAgentCatalog'
import type { TabSession } from '@shared/tabSession'

export interface DelegationThreadChatDelete {
  ref: AgentChatRef
  threadId: string
}

/**
 * Hilos con un turno todavía en vuelo, por pane. Podar uno le borraría el hilo
 * y el transcripto a un carril vivo.
 */
export type RunningThreadIdsByPane = ReadonlyMap<string, ReadonlySet<string>>

/** Saca de la lista a podar los hilos que el pane reporta como vivos. */
function withoutRunningThreads(
  byPane: ReadonlyMap<string, readonly string[]>,
  running: RunningThreadIdsByPane | undefined,
): ReadonlyMap<string, readonly string[]> {
  if (!running || running.size === 0) return byPane
  const filtered = new Map<string, readonly string[]>()
  for (const [paneId, threadIds] of byPane) {
    const live = running.get(paneId)
    if (!live || live.size === 0) {
      filtered.set(paneId, threadIds)
      continue
    }
    const keep = threadIds.filter(threadId => !live.has(threadId))
    if (keep.length > 0) filtered.set(paneId, keep)
  }
  return filtered
}

/**
 * `running` es un seguro, no el mecanismo: hoy todos los caminos que emiten un
 * resultado cierran el carril (`endLane`) antes de emitirlo, así que al podar ya
 * no queda nada vivo. Pero esta poda escribe los bindings directo, sin pasar por
 * la protección de carriles de `agentBindingFromMeta`, y ese orden no lo obliga
 * nadie: si algún día un resultado se emite antes de cerrar el carril, sin este
 * filtro se le borraría el hilo a un turno en curso.
 */
export function pruneDelegationThreadsByPane(
  tabs: TabSession[],
  byPaneInput: ReadonlyMap<string, readonly string[]>,
  now = Date.now(),
  createId: () => string = () => crypto.randomUUID(),
  running?: RunningThreadIdsByPane,
): { tabs: TabSession[]; chatDeletes: DelegationThreadChatDelete[] } {
  const byPane = withoutRunningThreads(byPaneInput, running)
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

function delegationIdsAndPanesFromJob(job: OrchestrationJob): {
  delegationIds: string[]
  paneIds: Set<string>
} {
  const delegationIds: string[] = []
  const seenDelegationIds = new Set<string>()
  const paneIds = new Set<string>()
  const addDelegationId = (raw?: string): void => {
    const id = raw?.trim()
    if (!id || seenDelegationIds.has(id)) return
    seenDelegationIds.add(id)
    delegationIds.push(id)
  }
  const addPaneId = (raw?: string): void => {
    const paneId = raw?.trim()
    if (paneId) paneIds.add(paneId)
  }
  for (const [delegationId, meta] of job.pending) {
    addDelegationId(delegationId)
    addPaneId(meta.toPaneId)
  }
  for (const item of job.waveItems) {
    addDelegationId(item.delegationId)
    addPaneId(item.toPaneId)
  }
  for (const result of job.completedResults) {
    addDelegationId(result.id)
    addPaneId(result.toPaneId)
  }
  return { delegationIds, paneIds }
}

export function pruneDelegationThreadsForJob(
  tabs: TabSession[],
  job: OrchestrationJob,
  now = Date.now(),
  createId: () => string = () => crypto.randomUUID(),
  running?: RunningThreadIdsByPane,
): { tabs: TabSession[]; chatDeletes: DelegationThreadChatDelete[] } {
  const base = collectDelegationThreadIdsByPaneFromJob(job)
  const { delegationIds, paneIds } = delegationIdsAndPanesFromJob(job)
  const extra = new Map<string, string[]>()
  for (const tab of tabs) {
    for (const [paneId, binding] of Object.entries(tab.agentByPane ?? {})) {
      if (!paneIds.has(paneId)) continue
      const threadIds = delegationThreadIdsForDelegationIds(
        threadStateOf(binding),
        delegationIds,
      )
      if (threadIds.length === 0) continue
      const list = extra.get(paneId) ?? []
      for (const threadId of threadIds) {
        if (!list.includes(threadId)) list.push(threadId)
      }
      extra.set(paneId, list)
    }
  }
  return pruneDelegationThreadsByPane(
    tabs,
    mergeDelegationThreadIdsByPane([base, extra]),
    now,
    createId,
    running,
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
