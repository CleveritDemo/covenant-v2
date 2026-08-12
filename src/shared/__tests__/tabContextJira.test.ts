import { describe, expect, it } from 'vitest'
import {
  ALL_CONTEXT_KINDS,
  CREATABLE_CONTEXT_KINDS,
  HOST_CONTEXT_KINDS,
  applyCanonicalContextIdentity,
  canonicalContextFileName,
  canonicalContextId,
  canonicalContextName,
  contextDefinitionKey,
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

  it('el dedup mira issueKey, no el nombre visible: renombrar no cambia con qué archivo se compara', () => {
    // Hallazgo arrastrado de la tarea 5: el campo Nombre del formulario es
    // libre para cualquier kind, incluido jira, así que un usuario puede
    // renombrar "GRAV-412" a "Bug de login" sin tocar la clave. El dedup no
    // puede seguir ese nombre o dos contextos jira con nombres distintos y la
    // misma clave dejarían de detectarse como el mismo archivo.
    const renamed: TabContext = {
      id: 'iaterminal:jira:grav-412',
      name: 'Bug de login',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
      issueKey: 'GRAV-412',
    }
    const sameIssueDifferentId: TabContext = {
      id: 'iaterminal:jira:grav-412',
      name: 'GRAV-412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
      issueKey: 'GRAV-412',
    }
    const otherIssue: TabContext = {
      id: 'iaterminal:jira:grav-500',
      name: 'GRAV-500',
      fileName: 'jira/GRAV-500.md',
      kind: 'jira',
      issueKey: 'GRAV-500',
    }
    expect(contextDefinitionKey(renamed)).toBe(contextDefinitionKey(sameIssueDifferentId))
    expect(contextDefinitionKey(renamed)).not.toBe(contextDefinitionKey(otherIssue))
  })

  it('un issueKey con espacios/símbolos (solo alcanzable a mano) dedupea igual que el archivo que de verdad ocupa', () => {
    // `contextFilePath` sanea con `normalizeContextFileName(issueKey.toUpperCase(), 'issue')`
    // antes de escribir a disco, así que un `issueKey: 'GRAV 412'` hand-edited
    // todavía termina en `jira/GRAV-412.md`. El dedup tiene que llegar a la
    // misma clave o dos contextos "distintos" (uno con espacio, otro con
    // guion) apuntarían de hecho al mismo archivo sin que nada lo detecte.
    const withSpace: TabContext = {
      id: 'iaterminal:jira:grav 412',
      name: 'GRAV 412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
      issueKey: 'GRAV 412',
    }
    const canonical: TabContext = {
      id: 'iaterminal:jira:grav-412',
      name: 'GRAV-412',
      fileName: 'jira/GRAV-412.md',
      kind: 'jira',
      issueKey: 'GRAV-412',
    }
    expect(contextDefinitionKey(withSpace)).toBe(contextDefinitionKey(canonical))
  })
})
