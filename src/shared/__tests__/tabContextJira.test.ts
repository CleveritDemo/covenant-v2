import { describe, expect, it } from 'vitest'
import {
  ALL_CONTEXT_KINDS,
  CREATABLE_CONTEXT_KINDS,
  HOST_CONTEXT_KINDS,
  applyCanonicalContextIdentity,
  canonicalContextFileName,
  canonicalContextId,
  canonicalContextName,
  type TabContext,
} from '../tabContext'
import { defaultIconForKind } from '../tabContextAppearance'

describe('kind jira', () => {
  it('está en los tres arrays que lo hacen visible y materializable', () => {
    expect(HOST_CONTEXT_KINDS).toContain('jira')
    expect(CREATABLE_CONTEXT_KINDS).toContain('jira')
    expect(ALL_CONTEXT_KINDS).toContain('jira')
  })

  it('el id canónico se deriva de la clave, en minúsculas', () => {
    expect(canonicalContextId('jira', { issueKey: 'GRAV-412' })).toBe('iaterminal:jira:grav-412')
  })

  it('el archivo vive bajo jira/, como results/ para agentResult', () => {
    expect(canonicalContextFileName('jira', { issueKey: 'GRAV-412' })).toBe('jira/GRAV-412.md')
  })

  it('sin clave no revienta: cae a un stem genérico', () => {
    expect(canonicalContextFileName('jira', {})).toBe('jira/issue.md')
  })

  it('el nombre visible es la clave', () => {
    expect(canonicalContextName('jira', { issueKey: 'GRAV-412' })).toBe('GRAV-412')
  })

  it('el icono por defecto es el de Jira, que ya existe en el kit', () => {
    expect(defaultIconForKind('jira')).toBe('jira')
  })

  it('el id canónico no cambia si además se pasa name/fileStem (Important 2)', () => {
    expect(canonicalContextId('jira', { issueKey: 'GRAV-412', name: 'GRAV-412' }))
      .toBe('iaterminal:jira:grav-412')
    expect(canonicalContextId('jira', { issueKey: 'GRAV-412', fileStem: 'jira/GRAV-412' }))
      .toBe('iaterminal:jira:grav-412')
  })

  it('sin issueKey explícito, cae al name/fileStem antes que al literal "issue"', () => {
    expect(canonicalContextId('jira', { name: 'GRAV-412' })).toBe('iaterminal:jira:grav-412')
    expect(canonicalContextId('jira', { fileStem: 'jira/GRAV-412' })).toBe('iaterminal:jira:grav-412')
  })

  it('applyCanonicalContextIdentity reconstruye issueKey desde el id cuando falta (Critical 1)', () => {
    // Exactamente la forma que devuelve discoverTabContexts antes de que la
    // metadata persista issueKey: sin el campo, pero con id/fileName reales.
    const discovered: TabContext = {
      id: 'iaterminal:jira:GRAV-412',
      name: 'GRAV-412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
    }
    const normalized = applyCanonicalContextIdentity(discovered)
    expect(normalized.issueKey).toBe('GRAV-412')
    expect(normalized.fileName).toBe('jira/GRAV-412.md')
  })

  it('applyCanonicalContextIdentity reconstruye issueKey desde fileName si el id tampoco lo trae', () => {
    const discovered: TabContext = {
      id: 'discovered-file:abc123',
      name: 'GRAV-412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
    }
    const normalized = applyCanonicalContextIdentity(discovered)
    expect(normalized.issueKey).toBe('GRAV-412')
    expect(normalized.fileName).toBe('jira/GRAV-412.md')
  })
})
