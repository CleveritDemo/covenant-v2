import { describe, expect, it, vi } from 'vitest'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import type { TabContext } from '@shared/tabContext'
import {
  downloadOrgWorkspaceToLocal,
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
    expect(payloads.map(p => ({ id: p.id, order: p.order, contextIds: p.contextIds }))).toEqual([
      { id: 'backend', order: 2, contextIds: ['rules'] },
      { id: 'qa', order: 0, contextIds: ['about', 'tree'] },
      { id: 'frontend', order: 1, contextIds: undefined },
    ])
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
})
