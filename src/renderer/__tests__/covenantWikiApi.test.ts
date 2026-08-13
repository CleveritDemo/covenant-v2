import { describe, expect, it } from 'vitest'
import {
  hasCovenantWikiApi,
  type CovenantApi,
  type CovenantWikiLogEntryRecord,
  type CovenantWikiPageRecord,
} from '../covenantApi'

const pageRecord: CovenantWikiPageRecord = {
  slug: 'alfa',
  title: 'Alfa',
  pageType: 'concept',
  body: 'a',
  createdAt: 0,
  updatedAt: 0,
}

const logRecord: CovenantWikiLogEntryRecord = {
  entry: 'alta de alfa',
  createdAt: 0,
}

function stubWikiApi(overrides: Partial<CovenantApi> = {}): CovenantApi {
  return {
    listWikiPages: async (_slug: string, _workspaceId: string) => (
      { ok: true, data: [pageRecord] }
    ),
    upsertWikiPage: async (
      _slug: string,
      _workspaceId: string,
      _pageSlug: string,
      _payload: { title: string; pageType: string; body: string },
    ) => ({ ok: true, data: pageRecord }),
    deleteWikiPage: async (_slug: string, _workspaceId: string, _pageSlug: string) => (
      { ok: true, data: null }
    ),
    appendWikiLog: async (_slug: string, _workspaceId: string, _entry: string) => (
      { ok: true, data: logRecord }
    ),
    listWikiLog: async (_slug: string, _workspaceId: string) => (
      { ok: true, data: [logRecord] }
    ),
    ...overrides,
  } as CovenantApi
}

describe('hasCovenantWikiApi', () => {
  it('exige listWikiPages/upsertWikiPage/deleteWikiPage/appendWikiLog/listWikiLog', () => {
    expect(hasCovenantWikiApi(stubWikiApi())).toBe(true)
  })

  it('falla si falta alguna de las cinco', () => {
    for (const key of [
      'listWikiPages',
      'upsertWikiPage',
      'deleteWikiPage',
      'appendWikiLog',
      'listWikiLog',
    ] as const) {
      const api = stubWikiApi()
      delete (api as Partial<CovenantApi>)[key]
      expect(hasCovenantWikiApi(api)).toBe(false)
    }
  })

  it('falla sin api', () => {
    expect(hasCovenantWikiApi(undefined)).toBe(false)
  })

  it('firmas: list/upsert/delete/log/listLog devuelven CovenantResult tipado', async () => {
    const api = stubWikiApi()
    const listed = await api.listWikiPages('acme', 'ws-1')
    expect(listed).toEqual({ ok: true, data: [pageRecord] })
    const upserted = await api.upsertWikiPage('acme', 'ws-1', 'alfa', {
      title: 'Alfa',
      pageType: 'concept',
      body: 'a',
    })
    expect(upserted.ok).toBe(true)
    const deleted = await api.deleteWikiPage('acme', 'ws-1', 'alfa')
    expect(deleted).toEqual({ ok: true, data: null })
    const logged = await api.appendWikiLog('acme', 'ws-1', 'alta de alfa')
    expect(logged).toEqual({ ok: true, data: logRecord })
    const logListed = await api.listWikiLog('acme', 'ws-1')
    expect(logListed).toEqual({ ok: true, data: [logRecord] })
  })
})
