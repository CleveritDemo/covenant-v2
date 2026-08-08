import { describe, expect, it } from 'vitest'
import { isOrgCatalogKey, shouldReplaceOrgAgentCatalog } from '../covenantTypes'

describe('isOrgCatalogKey', () => {
  it('true para covenant://workspaces/x/y', () => {
    expect(isOrgCatalogKey('covenant://workspaces/x/y')).toBe(true)
  })

  it('false para path absoluto', () => {
    expect(isOrgCatalogKey('/abs/path')).toBe(false)
  })

  it('false para string vacío', () => {
    expect(isOrgCatalogKey('')).toBe(false)
  })
})

describe('shouldReplaceOrgAgentCatalog', () => {
  it('incoming no vacío, existing undefined => true', () => {
    expect(shouldReplaceOrgAgentCatalog([{ id: 1 }], undefined)).toBe(true)
  })

  it('incoming no vacío, existing no vacío => true', () => {
    expect(shouldReplaceOrgAgentCatalog([{ id: 1 }], [{ id: 2 }])).toBe(true)
  })

  it('incoming vacío, existing no vacío => false (NO pisa)', () => {
    expect(shouldReplaceOrgAgentCatalog([], [{ id: 1 }])).toBe(false)
  })

  it('incoming vacío, existing vacío [] => true', () => {
    expect(shouldReplaceOrgAgentCatalog([], [])).toBe(true)
  })

  it('incoming vacío, existing undefined => true', () => {
    expect(shouldReplaceOrgAgentCatalog([], undefined)).toBe(true)
  })
})
