import { describe, expect, it } from 'vitest'
import type { ProjectAgentDefinition } from '../projectAgentCatalog'
import type { TabContext } from '../tabContext'
import {
  canUploadOrgWorkspaceChanges,
  filterSyncableOrgWorkspaceAgents,
  filterSyncableOrgWorkspaceContexts,
  isSyncableOrgWorkspaceAgent,
  isSyncableOrgWorkspaceContext,
  localContextsToWipeOnOrgResync,
  orderedAgentIdsFromTab,
  orgWorkspaceLocalIdsToUpsert,
  orgWorkspaceRemoteIdsToDelete,
  stampProjectAgentsPlaneOrder,
} from '../orgWorkspaceLocalSync'

function agent(
  id: string,
  extra: Partial<ProjectAgentDefinition> = {},
): ProjectAgentDefinition {
  return {
    id,
    provider: 'cursor',
    permissionMode: 'auto',
    emitResults: true,
    ...extra,
  }
}

function context(
  id: string,
  kind: TabContext['kind'],
): TabContext {
  return { id, name: id, fileName: `${id}.md`, kind }
}

describe('isSyncableOrgWorkspaceAgent', () => {
  it('excludes localOnly replicas', () => {
    expect(isSyncableOrgWorkspaceAgent(agent('fe'))).toBe(true)
    expect(isSyncableOrgWorkspaceAgent(agent('fe-2', { localOnly: true }))).toBe(false)
  })
})

describe('isSyncableOrgWorkspaceContext', () => {
  it('excludes agentResult', () => {
    expect(isSyncableOrgWorkspaceContext(context('n', 'notes'))).toBe(true)
    expect(isSyncableOrgWorkspaceContext(context('r', 'agentResult'))).toBe(false)
  })
})

describe('filterSyncableOrgWorkspaceAgents / Contexts', () => {
  it('upload filters localOnly and agentResult', () => {
    const agents = filterSyncableOrgWorkspaceAgents([
      agent('qa'),
      agent('fe-2', { localOnly: true }),
    ])
    expect(agents.map(a => a.id)).toEqual(['qa'])

    const contexts = filterSyncableOrgWorkspaceContexts([
      context('about', 'notes'),
      context('iaterminal:result:qa', 'agentResult'),
    ])
    expect(contexts.map(c => c.id)).toEqual(['about'])
  })
})

describe('localContextsToWipeOnOrgResync', () => {
  it('wipes syncable contexts and keeps agentResult', () => {
    const wiped = localContextsToWipeOnOrgResync([
      context('about', 'notes'),
      context('src', 'folderTree'),
      context('iaterminal:result:qa', 'agentResult'),
    ])
    expect(wiped.map(c => c.id)).toEqual(['about', 'src'])
  })
})

describe('orgWorkspaceRemoteIdsToDelete', () => {
  it('returns remote ids missing locally', () => {
    expect(orgWorkspaceRemoteIdsToDelete(['a', 'b'], ['a', 'c', 'd'])).toEqual(['c', 'd'])
    expect(orgWorkspaceRemoteIdsToDelete(new Set(['a']), ['a', 'b'])).toEqual(['b'])
  })
})

describe('orgWorkspaceLocalIdsToUpsert', () => {
  it('dedupes and trims', () => {
    expect(orgWorkspaceLocalIdsToUpsert([' a ', 'a', 'b', ''])).toEqual(['a', 'b'])
  })
})

describe('canUploadOrgWorkspaceChanges', () => {
  it('only true when canRename is true', () => {
    expect(canUploadOrgWorkspaceChanges(true)).toBe(true)
    expect(canUploadOrgWorkspaceChanges(false)).toBe(false)
    expect(canUploadOrgWorkspaceChanges(undefined)).toBe(false)
  })
})

describe('orderedAgentIdsFromTab / stampProjectAgentsPlaneOrder', () => {
  it('reads agent order from paneIds (session source of truth)', () => {
    expect(orderedAgentIdsFromTab({
      paneIds: ['t1', 'a-qa', 'a-fe', 'a-be'],
      paneKinds: {
        t1: 'terminal',
        'a-qa': 'agent',
        'a-fe': 'agent',
        'a-be': 'agent',
      },
      agentByPane: {
        'a-qa': { agentId: 'qa' },
        'a-fe': { agentId: 'frontend' },
        'a-be': { agentId: 'backend' },
      },
    })).toEqual(['qa', 'frontend', 'backend'])
  })

  it('stamps 0-based order for upload payloads', () => {
    const stamped = stampProjectAgentsPlaneOrder(
      [
        agent('backend', { contextIds: ['rules'] }),
        agent('frontend'),
        agent('qa', { contextIds: ['about'] }),
        agent('extra'),
      ],
      ['qa', 'frontend', 'backend'],
    )
    expect(stamped.map(a => ({ id: a.id, order: a.order, contextIds: a.contextIds }))).toEqual([
      { id: 'backend', order: 2, contextIds: ['rules'] },
      { id: 'frontend', order: 1, contextIds: undefined },
      { id: 'qa', order: 0, contextIds: ['about'] },
      { id: 'extra', order: 3, contextIds: undefined },
    ])
  })
})
