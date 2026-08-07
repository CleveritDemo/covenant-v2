import { describe, expect, it } from 'vitest'
import { sanitizeSlugSegment } from '../orgWorkspaceContent'

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
