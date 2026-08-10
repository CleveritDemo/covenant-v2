import { describe, expect, it } from 'vitest'
import {
  agentChatRefFor,
  normalizeAgentChatRef,
  planAgentChatCleanupForRemovedPanes,
  resolveAgentChatStorageKey,
  shouldDeleteAgentChatOnCatalogCleanup,
} from '../agentChatPersistence'

describe('agentChatPersistence helpers', () => {
  it('agentChatRefFor incluye legacyPaneId cuando la clave estable difiere', () => {
    const ref = agentChatRefFor({ projectFolder: '/proj' }, 'qa', 'pane-1')
    expect(ref.storageKey).toBe(resolveAgentChatStorageKey({ projectFolder: '/proj' }, 'qa', 'pane-1'))
    expect(ref.legacyPaneId).toBe('pane-1')
  })

  it('normalizeAgentChatRef acepta string legacy', () => {
    expect(normalizeAgentChatRef('  pane-x  ')).toEqual({ storageKey: 'pane-x' })
  })

  it('plan: preserve si agentId sigue en catálogo tras sync', () => {
    const scope = { orgWorkspace: { slug: 'acme', workspaceId: 'ws' } }
    const plan = planAgentChatCleanupForRemovedPanes(
      [{ paneId: 'p1', agentId: 'qa' }],
      new Set(['qa']),
      scope,
    )
    expect(plan[0]?.type).toBe('preserve')
    expect(shouldDeleteAgentChatOnCatalogCleanup('qa', new Set(['qa']))).toBe(false)
  })
})
