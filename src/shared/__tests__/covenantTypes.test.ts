import { describe, expect, it } from 'vitest'
import { shouldReplaceOrgAgentCatalog } from '../covenantTypes'

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
