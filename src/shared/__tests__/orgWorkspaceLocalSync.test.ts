import { describe, expect, it } from 'vitest'
import type { ProjectAgentDefinition } from '../projectAgentCatalog'
import type { TabContext } from '../tabContext'
import {
  buildOrgWorkspaceUploadPlan,
  canUploadOrgWorkspaceChanges,
  filterContextIdsAfterDiscover,
  filterSyncableOrgWorkspaceAgents,
  filterSyncableOrgWorkspaceContexts,
  isAgentResultContextId,
  isSyncableOrgWorkspaceAgent,
  isSyncableOrgWorkspaceContext,
  localContextsToWipeOnOrgResync,
  mergeRemoteAgentPreservingLocalResultContextIds,
  orderedAgentIdsFromTab,
  orgWorkspaceLocalIdsToUpsert,
  orgWorkspaceRemoteIdsToDelete,
  pickLocalAgentResultContextIds,
  stampProjectAgentsPlaneOrder,
  stripAgentResultContextIdsForUpload,
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

describe('buildOrgWorkspaceUploadPlan', () => {
  it('puts remote ids missing locally in delete lists', () => {
    expect(buildOrgWorkspaceUploadPlan({
      localAgentIds: ['qa'],
      localContextIds: ['about'],
      remoteAgentIds: ['qa', 'gone-agent'],
      remoteContextIds: ['about', 'old-notes'],
      includeAgents: true,
    })).toEqual({
      agentUpsertIds: ['qa'],
      contextUpsertIds: ['about'],
      agentIdsToDelete: ['gone-agent'],
      contextIdsToDelete: ['old-notes'],
    })
  })

  it('with includeAgents false keeps agent lists empty', () => {
    expect(buildOrgWorkspaceUploadPlan({
      localAgentIds: ['qa', 'frontend'],
      localContextIds: ['about'],
      remoteAgentIds: ['qa', 'gone-agent'],
      remoteContextIds: ['about', 'old-notes'],
      includeAgents: false,
    })).toEqual({
      agentUpsertIds: [],
      contextUpsertIds: ['about'],
      agentIdsToDelete: [],
      contextIdsToDelete: ['old-notes'],
    })
  })

  it('with identical local and remote sets yields empty delete lists', () => {
    expect(buildOrgWorkspaceUploadPlan({
      localAgentIds: ['qa'],
      localContextIds: ['about'],
      remoteAgentIds: ['qa'],
      remoteContextIds: ['about'],
      includeAgents: true,
    })).toEqual({
      agentUpsertIds: ['qa'],
      contextUpsertIds: ['about'],
      agentIdsToDelete: [],
      contextIdsToDelete: [],
    })
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

describe('agentResult contextId helpers', () => {
  it('isAgentResultContextId / pickLocalAgentResultContextIds', () => {
    expect(isAgentResultContextId('iaterminal:result:qa')).toBe(true)
    expect(isAgentResultContextId('iaterminal:notes:x')).toBe(false)
    expect(pickLocalAgentResultContextIds([
      'rules',
      'iaterminal:result:fullstack',
      'iaterminal:result:fullstack',
      'iaterminal:notes:x',
      ' iaterminal:result:qa ',
    ])).toEqual(['iaterminal:result:fullstack', 'iaterminal:result:qa'])
    expect(pickLocalAgentResultContextIds(undefined)).toEqual([])
  })

  it('mergeRemoteAgentPreservingLocalResultContextIds keeps remote order then local-only results', () => {
    const remote = agent('tech-lead', {
      contextIds: ['rules', 'iaterminal:notes:Front-Rules'],
      name: 'Tech Lead',
    })
    const local = agent('tech-lead', {
      contextIds: [
        'iaterminal:result:fullstack',
        'rules',
        'iaterminal:result:qa',
      ],
    })
    expect(mergeRemoteAgentPreservingLocalResultContextIds(remote, local)).toEqual({
      ...remote,
      contextIds: [
        'rules',
        'iaterminal:notes:Front-Rules',
        'iaterminal:result:fullstack',
        'iaterminal:result:qa',
      ],
    })
  })

  it('merge returns remote unchanged when nothing to append', () => {
    const remote = agent('qa', { contextIds: ['iaterminal:result:qa', 'rules'] })
    expect(mergeRemoteAgentPreservingLocalResultContextIds(remote, undefined)).toBe(remote)
    expect(mergeRemoteAgentPreservingLocalResultContextIds(
      remote,
      agent('qa', { contextIds: ['iaterminal:result:qa'] }),
    )).toBe(remote)
    expect(mergeRemoteAgentPreservingLocalResultContextIds(
      remote,
      agent('qa', { contextIds: ['rules'] }),
    )).toBe(remote)
  })

  it('stripAgentResultContextIdsForUpload omits result ids (and field if empty)', () => {
    expect(stripAgentResultContextIdsForUpload(
      agent('tl', { contextIds: ['rules', 'iaterminal:result:fullstack'] }),
    ).contextIds).toEqual(['rules'])
    expect(stripAgentResultContextIdsForUpload(
      agent('tl', { contextIds: ['iaterminal:result:fullstack'] }),
    ).contextIds).toBeUndefined()
    const clean = agent('tl', { contextIds: ['rules'] })
    expect(stripAgentResultContextIdsForUpload(clean)).toBe(clean)
  })

  it('filterContextIdsAfterDiscover keeps result ids not yet discovered', () => {
    expect(filterContextIdsAfterDiscover(
      ['rules', 'iaterminal:result:fullstack', 'gone'],
      new Set(['rules']),
    )).toEqual(['rules', 'iaterminal:result:fullstack'])
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
