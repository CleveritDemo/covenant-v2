import { describe, expect, it, vi } from 'vitest'
import type { TabContext } from '../tabContext'
import {
  forgetWorkspaceContextBody,
  orgWorkspacePersistContext,
  rememberWorkspaceContextBody,
  renameWorkspaceContext,
  renameWorkspaceContextFromTab,
  sanitizeSlugSegment,
  contextContentsForNotes,
  workspaceContextBody,
  workspaceContextUpsertPayload,
} from '../orgWorkspaceContent'
import type { CovenantWorkspaceContextRecord } from '../covenantTypes'

describe('sanitizeSlugSegment', () => {
  it('preserva caracteres seguros', () => {
    expect(sanitizeSlugSegment('Acme_Org.1-x')).toBe('Acme_Org.1-x')
  })

  it('colapsa caracteres inválidos a guiones', () => {
    expect(sanitizeSlugSegment('My Workspace!')).toBe('My-Workspace-')
    expect(sanitizeSlugSegment('a/b\\c')).toBe('a-b-c')
    expect(sanitizeSlugSegment('../evil')).toBe('..-evil')
  })

  it('recorta espacios extremos antes de colapsar', () => {
    expect(sanitizeSlugSegment('  team  ')).toBe('team')
  })
})

describe('orgWorkspacePersistContext', () => {
  const original: TabContext = {
    id: 'notes-old',
    name: 'Old',
    fileName: 'Old.md',
    kind: 'notes',
  }

  it('edit rename keeps originalId for upsert (no twin id)', () => {
    const normalized: TabContext = {
      ...original,
      id: 'notes-renamed',
      name: 'Renamed',
      fileName: 'Renamed.md',
    }
    const { persistId, context } = orgWorkspacePersistContext({
      mode: 'edit',
      originalId: 'notes-old',
      normalized,
    })
    expect(persistId).toBe('notes-old')
    expect(context.id).toBe('notes-old')
    expect(context.name).toBe('Renamed')
    expect(context.fileName).toBe('Renamed.md')
    const payload = workspaceContextUpsertPayload(context, 'body')
    expect(payload.name).toBe('Renamed')
    expect(payload.meta?.fileName).toBe('Renamed.md')
  })

  it('create uses normalized id', () => {
    const normalized: TabContext = {
      id: 'notes-new',
      name: 'New',
      fileName: 'New.md',
      kind: 'notes',
    }
    const { persistId, context } = orgWorkspacePersistContext({
      mode: 'create',
      originalId: '',
      normalized,
    })
    expect(persistId).toBe('notes-new')
    expect(context.id).toBe('notes-new')
  })
})

describe('renameWorkspaceContext', () => {
  const payload = {
    kind: 'notes',
    name: 'Beta',
    body: 'hello',
    meta: { fileName: 'Beta.md' },
  }

  it('upserts next id then deletes previous when ids differ', async () => {
    const upsert = vi.fn(async (id: string) => ({
      contextId: id,
      ...payload,
    } satisfies CovenantWorkspaceContextRecord))
    const del = vi.fn(async () => {})
    const result = await renameWorkspaceContext('iaterminal:notes:Alpha', 'iaterminal:notes:Beta', payload, {
      upsert,
      delete: del,
    })
    expect(upsert).toHaveBeenCalledWith('iaterminal:notes:Beta', payload)
    expect(del).toHaveBeenCalledWith('iaterminal:notes:Alpha')
    expect(result.deletedPrevious).toBe(true)
    expect(result.record.contextId).toBe('iaterminal:notes:Beta')
    expect(workspaceContextBody('iaterminal:notes:Beta')).toBe('hello')
    expect(workspaceContextBody('iaterminal:notes:Alpha')).toBe('')
  })

  it('skips delete when previous equals next (in-place update)', async () => {
    const upsert = vi.fn(async (id: string) => ({
      contextId: id,
      ...payload,
      name: 'Same',
    } satisfies CovenantWorkspaceContextRecord))
    const del = vi.fn(async () => {})
    const result = await renameWorkspaceContext('stable-id', 'stable-id', payload, {
      upsert,
      delete: del,
    })
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(del).not.toHaveBeenCalled()
    expect(result.deletedPrevious).toBe(false)
  })

  it('does not delete previous if upsert throws', async () => {
    const del = vi.fn(async () => {})
    await expect(renameWorkspaceContext('old', 'new', payload, {
      upsert: async () => { throw new Error('upsert failed') },
      delete: del,
    })).rejects.toThrow('upsert failed')
    expect(del).not.toHaveBeenCalled()
  })

  it('renameWorkspaceContextFromTab wires slug/ws and payload', async () => {
    rememberWorkspaceContextBody('old', 'ignored')
    const next: TabContext = {
      id: 'new',
      name: 'New',
      fileName: 'New.md',
      kind: 'notes',
    }
    const upsert = vi.fn(async (_s: string, _w: string, id: string, p: typeof payload) => ({
      contextId: id,
      kind: p.kind,
      name: p.name,
      body: p.body,
      meta: p.meta,
    } satisfies CovenantWorkspaceContextRecord))
    const del = vi.fn(async () => {})
    const result = await renameWorkspaceContextFromTab(
      'acme',
      'ws-1',
      'old',
      next,
      'notes body',
      { upsert, delete: del },
    )
    expect(upsert).toHaveBeenCalledWith(
      'acme',
      'ws-1',
      'new',
      expect.objectContaining({ name: 'New', body: 'notes body' }),
    )
    expect(del).toHaveBeenCalledWith('acme', 'ws-1', 'old')
    expect(result.deletedPrevious).toBe(true)
    forgetWorkspaceContextBody('new')
  })
})

describe('contextContentsForNotes', () => {
  it('includes remembered notes bodies and skips empty / non-notes', () => {
    rememberWorkspaceContextBody('iaterminal:notes:About', 'About product body')
    rememberWorkspaceContextBody('iaterminal:notes:Empty', '   ')
    const contents = contextContentsForNotes([
      {
        id: 'iaterminal:notes:About',
        name: 'About',
        fileName: 'About.md',
        kind: 'notes',
      },
      {
        id: 'iaterminal:notes:Empty',
        name: 'Empty',
        fileName: 'Empty.md',
        kind: 'notes',
      },
      {
        id: 'iaterminal:result:fe',
        name: 'FE results',
        fileName: 'results/fe.md',
        kind: 'agentResult',
      },
      {
        id: 'iaterminal:notes:Missing',
        name: 'Missing',
        fileName: 'Missing.md',
        kind: 'notes',
      },
    ])
    expect(contents).toEqual({
      'iaterminal:notes:About': 'About product body',
    })
    forgetWorkspaceContextBody('iaterminal:notes:About')
    forgetWorkspaceContextBody('iaterminal:notes:Empty')
  })
})
