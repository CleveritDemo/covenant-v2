/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import type { OrgWorkspaceCatalogEntry } from '../../shared/orgWorkspaceCatalog'
import { resolveOrgWorkspaceUploadGate } from '../App'

const baseEntry: OrgWorkspaceCatalogEntry = {
  slug: 'acme',
  orgName: 'Acme',
  workspaceId: 'ws-1',
  name: 'Proyecto',
}

describe('resolveOrgWorkspaceUploadGate', () => {
  it('entrada con canRename false bloquea con uploadError', () => {
    expect(resolveOrgWorkspaceUploadGate({ ...baseEntry, canRename: false })).toEqual({
      proceed: false,
      uploadError: 'not allowed to publish this workspace',
    })
  })

  it('entrada con canRename ausente bloquea con uploadError', () => {
    expect(resolveOrgWorkspaceUploadGate({ ...baseEntry })).toEqual({
      proceed: false,
      uploadError: 'not allowed to publish this workspace',
    })
  })

  it('entrada con canRename true permite subir', () => {
    expect(resolveOrgWorkspaceUploadGate({ ...baseEntry, canRename: true })).toEqual({
      proceed: true,
    })
  })

  it('sin entrada en catálogo permite subir', () => {
    expect(resolveOrgWorkspaceUploadGate(undefined)).toEqual({ proceed: true })
  })
})
