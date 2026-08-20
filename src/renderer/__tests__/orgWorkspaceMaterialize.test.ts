import { describe, expect, it, vi } from 'vitest'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'
import {
  downloadOrgWorkspaceToLocal,
  planOrgWorkspaceUpload,
  uploadOrgWorkspaceFromLocal,
  type OrgWorkspaceMaterializeDeps,
} from '../orgWorkspaceMaterialize'

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

function baseDeps(overrides: Partial<OrgWorkspaceMaterializeDeps> = {}): OrgWorkspaceMaterializeDeps {
  return {
    listRemoteAgents: async () => ({ ok: true, data: [] }),
    listRemoteContexts: async () => ({ ok: true, data: [] }),
    listLocalAgents: async () => [],
    upsertLocalAgent: async (_cwd, definition) => ({ ok: true, agent: definition }),
    deleteLocalAgent: async () => ({ ok: true }),
    discoverLocalContexts: async () => ({ ok: true, contexts: [] }),
    deleteLocalContext: async () => ({ ok: true }),
    materializeLocalContext: async () => ({ ok: true, notesContent: '' }),
    previewLocalContext: async () => ({ ok: true, notesContent: 'note body' }),
    upsertRemoteAgent: async () => ({
      ok: true,
      data: { agentId: 'x', definition: {} },
    }),
    deleteRemoteAgent: async () => ({ ok: true, data: undefined }),
    upsertRemoteContext: async () => ({
      ok: true,
      data: { contextId: 'x', kind: 'notes', name: 'x', body: '' },
    }),
    deleteRemoteContext: async () => ({ ok: true, data: undefined }),
    ...overrides,
  }
}

describe('downloadOrgWorkspaceToLocal', () => {
  it('resync wipes syncable local and keeps agentResult', async () => {
    const deletedAgents: string[] = []
    const deletedContexts: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [{ agentId: 'qa', definition: { id: 'qa', provider: 'cursor', permissionMode: 'auto' } }],
      }),
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId: 'about', kind: 'notes', name: 'About', body: 'hi' }],
      }),
      listLocalAgents: async () => [
        agent('old'),
        agent('fe-2', { localOnly: true }),
      ],
      deleteLocalAgent: async (_cwd, id) => {
        deletedAgents.push(id)
        return { ok: true }
      },
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [
          context('stale', 'notes'),
          context('iaterminal:result:qa', 'agentResult'),
        ],
      }),
      deleteLocalContext: async (ctx) => {
        deletedContexts.push(ctx.id)
        return { ok: true }
      },
    })

    const result = await downloadOrgWorkspaceToLocal('/ws', deps, { wipeLocal: true })
    expect(result.agentsOk).toBe(true)
    expect(result.contextsOk).toBe(true)
    expect(deletedAgents.sort()).toEqual(['fe-2', 'old'])
    expect(deletedContexts).toEqual(['stale'])
  })

  it('wipeLocal false upserts remote and keeps local extras', async () => {
    const deletedAgents: string[] = []
    const deletedContexts: string[] = []
    const upsertedAgents: string[] = []
    const materializedContexts: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [{ agentId: 'qa', definition: { id: 'qa', provider: 'cursor', permissionMode: 'auto' } }],
      }),
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId: 'about', kind: 'notes', name: 'About', body: 'hi' }],
      }),
      listLocalAgents: async () => [
        agent('old'),
        agent('localOnly', { localOnly: true }),
      ],
      deleteLocalAgent: async (_cwd, id) => {
        deletedAgents.push(id)
        return { ok: true }
      },
      upsertLocalAgent: async (_cwd, definition) => {
        upsertedAgents.push(definition.id)
        return { ok: true, agent: definition }
      },
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [
          context('stale', 'notes'),
          context('iaterminal:result:qa', 'agentResult'),
        ],
      }),
      deleteLocalContext: async (ctx) => {
        deletedContexts.push(ctx.id)
        return { ok: true }
      },
      materializeLocalContext: async ({ context: ctx }) => {
        materializedContexts.push(ctx.id)
        return { ok: true, notesContent: '' }
      },
    })

    const result = await downloadOrgWorkspaceToLocal('/ws', deps, { wipeLocal: false })
    expect(result.agentsOk).toBe(true)
    expect(result.contextsOk).toBe(true)
    expect(deletedAgents).toEqual([])
    expect(deletedContexts).toEqual([])
    expect(upsertedAgents).toEqual(['qa'])
    expect(materializedContexts).toEqual(['about'])
  })

  it('isCancelled mid agent-upsert loop returns cancelled without remaining upserts', async () => {
    let upsertCount = 0
    let cancelAfterFirstUpsert = false
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [
          { agentId: 'a', definition: { id: 'a', provider: 'cursor', permissionMode: 'auto' } },
          { agentId: 'b', definition: { id: 'b', provider: 'cursor', permissionMode: 'auto' } },
          { agentId: 'c', definition: { id: 'c', provider: 'cursor', permissionMode: 'auto' } },
        ],
      }),
      upsertLocalAgent: async (_cwd, definition) => {
        upsertCount += 1
        cancelAfterFirstUpsert = true
        return { ok: true, agent: definition }
      },
    })

    const result = await downloadOrgWorkspaceToLocal('/ws', deps, {
      wipeLocal: false,
      isCancelled: () => cancelAfterFirstUpsert,
    })

    expect(result).toEqual({ agentsOk: true, contextsOk: true, cancelled: true })
    expect(upsertCount).toBe(1)
  })

  it('wipeLocal download merges local iaterminal:result:* onto remote agents', async () => {
    const upserted: ProjectAgentDefinition[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [{
          agentId: 'tech-lead',
          definition: {
            id: 'tech-lead',
            provider: 'cursor',
            permissionMode: 'auto',
            contextIds: ['iaterminal:notes:Front-Rules'],
          },
        }],
      }),
      listLocalAgents: async () => [
        agent('tech-lead', {
          contextIds: [
            'iaterminal:notes:Front-Rules',
            'iaterminal:result:fullstack',
          ],
        }),
      ],
      upsertLocalAgent: async (_cwd, definition) => {
        upserted.push(definition)
        return { ok: true, agent: definition }
      },
    })

    const result = await downloadOrgWorkspaceToLocal('/ws', deps, { wipeLocal: true })
    expect(result.agentsOk).toBe(true)
    expect(upserted).toHaveLength(1)
    expect(upserted[0]?.contextIds).toEqual([
      'iaterminal:notes:Front-Rules',
      'iaterminal:result:fullstack',
    ])
  })

  it('includeAgents false skips agents, materializes contexts and wiki, agentsOk true', async () => {
    const listRemoteAgents = vi.fn(async () => ({
      ok: true as const,
      data: [{ agentId: 'qa', definition: { id: 'qa', provider: 'cursor', permissionMode: 'auto' } }],
    }))
    const upsertLocalAgent = vi.fn(async (_cwd: string, definition: ProjectAgentDefinition) => ({
      ok: true as const,
      agent: definition,
    }))
    const listLocalAgents = vi.fn(async () => [agent('local')])
    const materializedContexts: string[] = []
    const wikiReplaced: string[] = []
    const wikiPagesReplaced = vi.fn(async () => {})
    const deps = baseDeps({
      listRemoteAgents,
      listLocalAgents,
      upsertLocalAgent,
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId: 'about', kind: 'notes', name: 'About', body: 'hi' }],
      }),
      materializeLocalContext: async ({ context: ctx }) => {
        materializedContexts.push(ctx.id)
        return { ok: true, notesContent: '' }
      },
      listRemoteWikiPages: async () => ({
        ok: true,
        data: [{
          slug: 'overview',
          title: 'Overview',
          pageType: 'concept',
          body: 'wiki body',
          updatedAt: 1,
          updatedBy: null,
        }],
      }),
      replaceLocalWikiPages: async (_cwd, pages) => {
        wikiReplaced.push(...pages.map(p => p.slug))
        return { ok: true }
      },
      listRemoteWikiLog: async () => ({ ok: true, data: [] }),
      replaceLocalWikiLog: async () => ({ ok: true }),
      onWikiPagesReplaced: wikiPagesReplaced,
    })

    const result = await downloadOrgWorkspaceToLocal('/ws', deps, {
      wipeLocal: false,
      includeAgents: false,
    })

    expect(listRemoteAgents).not.toHaveBeenCalled()
    expect(listLocalAgents).not.toHaveBeenCalled()
    expect(upsertLocalAgent).not.toHaveBeenCalled()
    expect(materializedContexts).toEqual(['about'])
    expect(wikiReplaced).toEqual(['overview'])
    expect(wikiPagesReplaced).toHaveBeenCalled()
    expect(result.agentsOk).toBe(true)
    expect(result.contextsOk).toBe(true)
    expect(result.agentsError).toBeUndefined()
  })

  it('includeAgents false + wipeLocal does not delete local agents', async () => {
    const deleteLocalAgent = vi.fn(async () => ({ ok: true }))
    const deletedContexts: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [{ agentId: 'qa', definition: { id: 'qa', provider: 'cursor', permissionMode: 'auto' } }],
      }),
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId: 'about', kind: 'notes', name: 'About', body: 'hi' }],
      }),
      listLocalAgents: async () => [agent('old'), agent('fe-2', { localOnly: true })],
      deleteLocalAgent,
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [
          context('stale', 'notes'),
          context('iaterminal:result:qa', 'agentResult'),
        ],
      }),
      deleteLocalContext: async (ctx) => {
        deletedContexts.push(ctx.id)
        return { ok: true }
      },
    })

    const result = await downloadOrgWorkspaceToLocal('/ws', deps, {
      wipeLocal: true,
      includeAgents: false,
    })

    expect(deleteLocalAgent).not.toHaveBeenCalled()
    expect(deletedContexts).toEqual(['stale'])
    expect(result.agentsOk).toBe(true)
    expect(result.contextsOk).toBe(true)
  })

  it('includeAgents false onPhase skips agents', async () => {
    const phases: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [{ agentId: 'qa', definition: { id: 'qa', provider: 'cursor', permissionMode: 'auto' } }],
      }),
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId: 'about', kind: 'notes', name: 'About', body: 'hi' }],
      }),
      listRemoteWikiPages: async () => ({ ok: true, data: [] }),
      replaceLocalWikiPages: async () => ({ ok: true }),
    })

    await downloadOrgWorkspaceToLocal('/ws', deps, {
      wipeLocal: false,
      includeAgents: false,
      onPhase: phase => { phases.push(phase) },
    })

    expect(phases).toEqual(['contexts', 'wiki'])
    expect(phases).not.toContain('agents')
  })

  it('without includeAgents still downloads and upserts agents', async () => {
    const listRemoteAgents = vi.fn(async () => ({
      ok: true as const,
      data: [{ agentId: 'qa', definition: { id: 'qa', provider: 'cursor', permissionMode: 'auto' } }],
    }))
    const upsertedAgents: string[] = []
    const phases: string[] = []
    const deps = baseDeps({
      listRemoteAgents,
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId: 'about', kind: 'notes', name: 'About', body: 'hi' }],
      }),
      upsertLocalAgent: async (_cwd, definition) => {
        upsertedAgents.push(definition.id)
        return { ok: true, agent: definition }
      },
    })

    const result = await downloadOrgWorkspaceToLocal('/ws', deps, {
      wipeLocal: false,
      onPhase: phase => { phases.push(phase) },
    })

    expect(listRemoteAgents).toHaveBeenCalled()
    expect(upsertedAgents).toEqual(['qa'])
    expect(phases[0]).toBe('agents')
    expect(result.agentsOk).toBe(true)
    expect(result.contextsOk).toBe(true)
  })
})

describe('planOrgWorkspaceUpload', () => {
  it('lists local and remote without remote mutations', async () => {
    const upsertRemoteAgent = vi.fn(async () => ({
      ok: true as const,
      data: { agentId: 'x', definition: {} },
    }))
    const deleteRemoteAgent = vi.fn(async () => ({ ok: true as const, data: undefined }))
    const upsertRemoteContext = vi.fn(async () => ({
      ok: true as const,
      data: { contextId: 'x', kind: 'notes' as const, name: 'x', body: '' },
    }))
    const deleteRemoteContext = vi.fn(async () => ({ ok: true as const, data: undefined }))
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [
          { agentId: 'qa', definition: {} },
          { agentId: 'gone', definition: {} },
        ],
      }),
      listRemoteContexts: async () => ({
        ok: true,
        data: [
          { contextId: 'about', kind: 'notes', name: 'About', body: '' },
          { contextId: 'old-notes', kind: 'notes', name: 'Old', body: '' },
        ],
      }),
      listLocalAgents: async () => [
        agent('qa'),
        agent('fe-2', { localOnly: true }),
      ],
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [
          context('about', 'notes'),
          context('iaterminal:result:qa', 'agentResult'),
        ],
      }),
      upsertRemoteAgent,
      deleteRemoteAgent,
      upsertRemoteContext,
      deleteRemoteContext,
    })

    const result = await planOrgWorkspaceUpload('/ws', deps)
    expect(result).toEqual({
      ok: true,
      plan: {
        agentUpsertIds: ['qa'],
        contextUpsertIds: ['about'],
        agentIdsToDelete: ['gone'],
        contextIdsToDelete: ['old-notes'],
      },
    })
    expect(upsertRemoteAgent).not.toHaveBeenCalled()
    expect(deleteRemoteAgent).not.toHaveBeenCalled()
    expect(upsertRemoteContext).not.toHaveBeenCalled()
    expect(deleteRemoteContext).not.toHaveBeenCalled()
  })
})

describe('uploadOrgWorkspaceFromLocal', () => {
  it('skips localOnly agents and agentResult contexts', async () => {
    const upsertedAgents: string[] = []
    const deletedAgents: string[] = []
    const upsertedContexts: string[] = []
    const deletedContexts: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [
          { agentId: 'qa', definition: {} },
          { agentId: 'gone', definition: {} },
        ],
      }),
      listRemoteContexts: async () => ({
        ok: true,
        data: [
          { contextId: 'about', kind: 'notes', name: 'About', body: '' },
          { contextId: 'old-notes', kind: 'notes', name: 'Old', body: '' },
        ],
      }),
      listLocalAgents: async () => [
        agent('qa'),
        agent('fe-2', { localOnly: true }),
      ],
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [
          context('about', 'notes'),
          context('iaterminal:result:qa', 'agentResult'),
        ],
      }),
      upsertRemoteAgent: async (id) => {
        upsertedAgents.push(id)
        return { ok: true, data: { agentId: id, definition: {} } }
      },
      deleteRemoteAgent: async (id) => {
        deletedAgents.push(id)
        return { ok: true, data: undefined }
      },
      upsertRemoteContext: async (id) => {
        upsertedContexts.push(id)
        return { ok: true, data: { contextId: id, kind: 'notes', name: id, body: '' } }
      },
      deleteRemoteContext: async (id) => {
        deletedContexts.push(id)
        return { ok: true, data: undefined }
      },
      previewLocalContext: async () => ({ ok: true, notesContent: 'clean notes' }),
    })

    const result = await uploadOrgWorkspaceFromLocal('/ws', deps)
    expect(result.ok).toBe(true)
    expect(upsertedAgents).toEqual(['qa'])
    expect(deletedAgents).toEqual(['gone'])
    expect(upsertedContexts).toEqual(['about'])
    expect(deletedContexts).toEqual(['old-notes'])
  })

  it('stamps plane order and preserves contextIds on upsert payloads', async () => {
    const payloads: ProjectAgentDefinition[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({ ok: true, data: [] }),
      listRemoteContexts: async () => ({ ok: true, data: [] }),
      listLocalAgents: async () => [
        agent('backend', { contextIds: ['rules'] }),
        agent('qa', { contextIds: ['about', 'tree'] }),
        agent('frontend'),
      ],
      upsertRemoteAgent: async (_id, definition) => {
        payloads.push(definition)
        return { ok: true, data: { agentId: definition.id, definition: { ...definition } } }
      },
    })

    const result = await uploadOrgWorkspaceFromLocal('/ws', deps, {
      orderedAgentIds: ['qa', 'frontend', 'backend'],
    })
    expect(result.ok).toBe(true)
    expect(payloads.map(p => ({ id: p.id, order: p.order, contextIds: p.contextIds }))).toEqual(
      expect.arrayContaining([
        { id: 'backend', order: 2, contextIds: ['rules'] },
        { id: 'qa', order: 0, contextIds: ['about', 'tree'] },
        { id: 'frontend', order: 1, contextIds: undefined },
      ]),
    )
    expect(payloads).toHaveLength(3)
  })

  it('reports upload progress through onProgress', async () => {
    const progress: number[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({ ok: true, data: [] }),
      listRemoteContexts: async () => ({ ok: true, data: [] }),
      listLocalAgents: async () => [agent('qa')],
      upsertRemoteAgent: async id => ({ ok: true, data: { agentId: id, definition: {} } }),
    })

    const result = await uploadOrgWorkspaceFromLocal('/ws', deps, {
      onProgress: percent => progress.push(percent),
    })
    expect(result.ok).toBe(true)
    expect(progress.length).toBeGreaterThan(0)
    expect(progress[progress.length - 1]).toBe(85)
  })

  it('strips iaterminal:result:* from remote agent upsert payloads', async () => {
    const payloads: ProjectAgentDefinition[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({ ok: true, data: [] }),
      listRemoteContexts: async () => ({ ok: true, data: [] }),
      listLocalAgents: async () => [
        agent('tech-lead', {
          contextIds: [
            'iaterminal:notes:Front-Rules',
            'iaterminal:result:fullstack',
            'rules',
          ],
        }),
        agent('qa', { contextIds: ['iaterminal:result:qa'] }),
      ],
      upsertRemoteAgent: async (_id, definition) => {
        payloads.push(definition)
        return { ok: true, data: { agentId: definition.id, definition: { ...definition } } }
      },
    })

    const result = await uploadOrgWorkspaceFromLocal('/ws', deps)
    expect(result.ok).toBe(true)
    expect(payloads.map(p => ({ id: p.id, contextIds: p.contextIds }))).toEqual(
      expect.arrayContaining([
        {
          id: 'tech-lead',
          contextIds: ['iaterminal:notes:Front-Rules', 'rules'],
        },
        { id: 'qa', contextIds: undefined },
      ]),
    )
    expect(payloads).toHaveLength(2)
  })

  it('uses notesContent from preview for upsert payload', async () => {
    const preview = vi.fn(async () => ({ ok: true as const, notesContent: 'from preview' }))
    let capturedBody = ''
    const deps = baseDeps({
      listRemoteAgents: async () => ({ ok: true, data: [] }),
      listRemoteContexts: async () => ({ ok: true, data: [] }),
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [context('about', 'notes')],
      }),
      previewLocalContext: preview,
      upsertRemoteContext: async (_id, payload) => {
        capturedBody = payload.body ?? ''
        return { ok: true, data: { contextId: 'about', kind: 'notes', name: 'about', body: capturedBody } }
      },
    })
    await uploadOrgWorkspaceFromLocal('/ws', deps)
    expect(preview).toHaveBeenCalled()
    expect(capturedBody).toBe('from preview')
  })

  it('shouldCancel after first agent upsert stops further remote mutations', async () => {
    const upsertedAgents: string[] = []
    const deletedAgents: string[] = []
    const upsertedContexts: string[] = []
    const deletedContexts: string[] = []
    let cancelAfterFirstUpsert = false
    const deps = baseDeps({
      listRemoteAgents: async () => ({ ok: true, data: [] }),
      listRemoteContexts: async () => ({ ok: true, data: [] }),
      listLocalAgents: async () => [agent('a'), agent('b'), agent('c')],
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [context('about', 'notes')],
      }),
      upsertRemoteAgent: async id => {
        upsertedAgents.push(id)
        cancelAfterFirstUpsert = true
        return { ok: true, data: { agentId: id, definition: {} } }
      },
      deleteRemoteAgent: async id => {
        deletedAgents.push(id)
        return { ok: true, data: undefined }
      },
      upsertRemoteContext: async id => {
        upsertedContexts.push(id)
        return { ok: true, data: { contextId: id, kind: 'notes', name: id, body: '' } }
      },
      deleteRemoteContext: async id => {
        deletedContexts.push(id)
        return { ok: true, data: undefined }
      },
    })

    const result = await uploadOrgWorkspaceFromLocal('/ws', deps, {
      shouldCancel: () => cancelAfterFirstUpsert,
    })

    expect(result).toEqual({ ok: false, cancelled: true, error: 'cancelled' })
    expect(upsertedAgents).toEqual(['a'])
    expect(deletedAgents).toEqual([])
    expect(upsertedContexts).toEqual([])
    expect(deletedContexts).toEqual([])
  })

  it('without shouldCancel keeps upload behavior and progress unchanged', async () => {
    const progress: number[] = []
    const upsertedAgents: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [{ agentId: 'gone', definition: {} }],
      }),
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId: 'old-notes', kind: 'notes', name: 'Old', body: '' }],
      }),
      listLocalAgents: async () => [agent('qa')],
      discoverLocalContexts: async () => ({
        ok: true,
        contexts: [context('about', 'notes')],
      }),
      upsertRemoteAgent: async id => {
        upsertedAgents.push(id)
        return { ok: true, data: { agentId: id, definition: {} } }
      },
    })

    const result = await uploadOrgWorkspaceFromLocal('/ws', deps, {
      onProgress: percent => progress.push(percent),
    })

    expect(result).toEqual({ ok: true })
    expect(result.cancelled).toBeUndefined()
    expect(upsertedAgents).toEqual(['qa'])
    expect(progress.length).toBeGreaterThan(0)
    expect(progress[progress.length - 1]).toBe(85)
  })
})

describe('downloadOrgWorkspaceToLocal order', () => {
  it('writes remote agents in definition.order (not localeCompare)', async () => {
    const written: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [
          {
            agentId: 'alpha',
            definition: {
              id: 'alpha',
              provider: 'cursor',
              permissionMode: 'auto',
              order: 2,
            },
          },
          {
            agentId: 'zeta',
            definition: {
              id: 'zeta',
              provider: 'cursor',
              permissionMode: 'auto',
              order: 0,
              contextIds: ['about'],
            },
          },
          {
            agentId: 'beta',
            definition: {
              id: 'beta',
              provider: 'cursor',
              permissionMode: 'auto',
              order: 1,
            },
          },
        ],
      }),
      upsertLocalAgent: async (_cwd, definition) => {
        written.push(definition.id)
        return { ok: true, agent: definition }
      },
    })
    const result = await downloadOrgWorkspaceToLocal('/ws', deps)
    expect(result.agentsOk).toBe(true)
    expect(written).toEqual(['zeta', 'beta', 'alpha'])
  })

  it('without order uses preferredAgentIds then new ids', async () => {
    const written: string[] = []
    const deps = baseDeps({
      listRemoteAgents: async () => ({
        ok: true,
        data: [
          { agentId: 'new-z', definition: { id: 'new-z', provider: 'cursor', permissionMode: 'auto' } },
          { agentId: 'qa', definition: { id: 'qa', provider: 'cursor', permissionMode: 'auto' } },
          { agentId: 'frontend', definition: { id: 'frontend', provider: 'cursor', permissionMode: 'auto' } },
        ],
      }),
      upsertLocalAgent: async (_cwd, definition) => {
        written.push(definition.id)
        return { ok: true, agent: definition }
      },
    })
    await downloadOrgWorkspaceToLocal('/ws', deps, {
      wipeLocal: false,
      preferredAgentIds: ['frontend', 'qa'],
    })
    expect(written).toEqual(['frontend', 'qa', 'new-z'])
  })

  it('scoped downloads keep distinct bodies for same contextId', async () => {
    const materialized: Array<{ cwd: string; content?: string }> = []
    const contextId = 'iaterminal:notes:Design-Language'
    const makeDeps = (body: string) => baseDeps({
      listRemoteContexts: async () => ({
        ok: true,
        data: [{ contextId, kind: 'notes', name: 'Design Language', body }],
      }),
      materializeLocalContext: async ({ cwd, content }) => {
        materialized.push({ cwd, content })
        return { ok: true, notesContent: content ?? '' }
      },
    })

    await downloadOrgWorkspaceToLocal('/ws-a', makeDeps('body workspace A'), {
      wipeLocal: false,
      orgWorkspaceScope: { slug: 'acme', workspaceId: 'ws-a', localDir: '/ws-a' },
    })
    await downloadOrgWorkspaceToLocal('/ws-b', makeDeps('body workspace B'), {
      wipeLocal: false,
      orgWorkspaceScope: { slug: 'acme', workspaceId: 'ws-b', localDir: '/ws-b' },
    })

    expect(materialized).toEqual([
      { cwd: '/ws-a', content: 'body workspace A' },
      { cwd: '/ws-b', content: 'body workspace B' },
    ])
  })

  it('wiki page list failure returns wikiError', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = baseDeps({
      listRemoteWikiPages: async () => ({ ok: false, error: 'wiki list boom' }),
      replaceLocalWikiPages: async () => ({ ok: true }),
    })
    const result = await downloadOrgWorkspaceToLocal('/ws', deps)
    expect(result.wikiError).toBe('wiki list boom')
    expect(result.agentsOk).toBe(true)
    expect(result.contextsOk).toBe(true)
    warn.mockRestore()
  })

  it('wiki log failure alone does not set wikiError', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deps = baseDeps({
      listRemoteWikiPages: async () => ({ ok: true, data: [] }),
      replaceLocalWikiPages: async () => ({ ok: true }),
      listRemoteWikiLog: async () => ({ ok: false, error: 'log list boom' }),
      replaceLocalWikiLog: async () => ({ ok: true }),
    })
    const result = await downloadOrgWorkspaceToLocal('/ws', deps)
    expect(result.wikiError).toBeUndefined()
    expect(result.agentsOk).toBe(true)
    expect(result.contextsOk).toBe(true)
    warn.mockRestore()
  })
})
