import { describe, expect, it } from 'vitest'
import {
  ALL_CONTEXT_KINDS,
  CREATABLE_CONTEXT_KINDS,
  HOST_CONTEXT_KINDS,
  canonicalContextFileName,
  canonicalContextId,
  canonicalContextName,
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
})
