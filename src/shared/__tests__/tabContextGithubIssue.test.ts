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
  contextFileStem,
  type TabContext,
} from '../tabContext'
import { defaultIconForKind } from '../tabContextAppearance'

describe('kind githubIssue', () => {
  it('está en los tres arrays que lo hacen visible y materializable', () => {
    expect(HOST_CONTEXT_KINDS).toContain('githubIssue')
    expect(CREATABLE_CONTEXT_KINDS).toContain('githubIssue')
    expect(ALL_CONTEXT_KINDS).toContain('githubIssue')
  })

  it('el id canónico es iaterminal:githubissue:<owner>-<repo>-<number>', () => {
    expect(canonicalContextId('githubIssue', {
      repoFullName: 'CleveritDemo/covenant-v2',
      issueNumber: 86,
    })).toBe('iaterminal:githubissue:cleveritdemo-covenant-v2-86')
  })

  it('el archivo vive bajo github/', () => {
    expect(canonicalContextFileName('githubIssue', {
      repoFullName: 'CleveritDemo/covenant-v2',
      issueNumber: 86,
    })).toBe('github/CleveritDemo-covenant-v2-86.md')
  })

  it('sin clave no revienta: cae a un stem genérico', () => {
    expect(canonicalContextFileName('githubIssue', {})).toBe('github/issue.md')
  })

  it('el nombre visible es repo#número', () => {
    expect(canonicalContextName('githubIssue', {
      repoFullName: 'CleveritDemo/covenant-v2',
      issueNumber: 86,
    })).toBe('CleveritDemo/covenant-v2#86')
  })

  it('contextFileStem recorta el prefijo github/', () => {
    expect(contextFileStem('github/CleveritDemo-covenant-v2-86.md')).toBe('CleveritDemo-covenant-v2-86')
  })

  it('el icono por defecto es github', () => {
    expect(defaultIconForKind('githubIssue')).toBe('github')
  })

  it('el id canónico no cambia si además se pasa name/fileStem', () => {
    expect(canonicalContextId('githubIssue', {
      repoFullName: 'acme/app',
      issueNumber: 12,
      name: 'acme/app#12',
    })).toBe('iaterminal:githubissue:acme-app-12')
    expect(canonicalContextId('githubIssue', {
      repoFullName: 'acme/app',
      issueNumber: 12,
      fileStem: 'github/acme-app-12',
    })).toBe('iaterminal:githubissue:acme-app-12')
  })

  it('sin repo/número explícitos, cae al fileStem', () => {
    expect(canonicalContextId('githubIssue', { fileStem: 'github/acme-app-12' }))
      .toBe('iaterminal:githubissue:acme-app-12')
  })

  it('applyCanonicalContextIdentity reconstruye issueNumber desde el id cuando falta', () => {
    const discovered: TabContext = {
      id: 'iaterminal:githubissue:acme-app-12',
      name: 'acme/app#12',
      fileName: 'github/acme-app-12.md',
      kind: 'githubIssue',
    }
    const normalized = applyCanonicalContextIdentity(discovered)
    expect(normalized.issueNumber).toBe(12)
    expect(normalized.fileName).toBe('github/acme-app-12.md')
  })

  it('applyCanonicalContextIdentity reconstruye issueNumber desde fileName si el id tampoco lo trae', () => {
    const discovered: TabContext = {
      id: 'discovered-file:abc123',
      name: '#12',
      fileName: 'github/acme-app-12.md',
      kind: 'githubIssue',
    }
    const normalized = applyCanonicalContextIdentity(discovered)
    expect(normalized.issueNumber).toBe(12)
    expect(normalized.fileName).toBe('github/acme-app-12.md')
  })

  it('el dedup mira repo+número, no el nombre visible', () => {
    const renamed: TabContext = {
      id: 'iaterminal:githubissue:acme-app-12',
      name: 'Bug de login',
      fileName: 'github/acme-app-12.md',
      kind: 'githubIssue',
      issueNumber: 12,
      repoFullName: 'acme/app',
    }
    const same: TabContext = {
      id: 'iaterminal:githubissue:acme-app-12',
      name: 'acme/app#12',
      fileName: 'github/acme-app-12.md',
      kind: 'githubIssue',
      issueNumber: 12,
      repoFullName: 'acme/app',
    }
    const other: TabContext = {
      id: 'iaterminal:githubissue:acme-app-13',
      name: 'acme/app#13',
      fileName: 'github/acme-app-13.md',
      kind: 'githubIssue',
      issueNumber: 13,
      repoFullName: 'acme/app',
    }
    expect(contextDefinitionKey(renamed)).toBe(contextDefinitionKey(same))
    expect(contextDefinitionKey(renamed)).not.toBe(contextDefinitionKey(other))
  })
})
