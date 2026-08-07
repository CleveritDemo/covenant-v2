import { describe, expect, it } from 'vitest'
import { normalizeRepoFullName, repoFullNameFromCloneUrl } from '../repoFullName'

describe('normalizeRepoFullName', () => {
  it('colapsa mayúsculas, .git y espacios/slashes a la misma forma', () => {
    expect(normalizeRepoFullName('Owner/Repo')).toBe('owner/repo')
    expect(normalizeRepoFullName('owner/repo.git')).toBe('owner/repo')
    expect(normalizeRepoFullName(' owner/repo/ ')).toBe('owner/repo')
    expect(normalizeRepoFullName('OWNER/REPO.GIT')).toBe('owner/repo')
  })

  it('trata variantes equivalentes como idénticas', () => {
    const a = normalizeRepoFullName('Acme/App')
    const b = normalizeRepoFullName('acme/app.git')
    const c = normalizeRepoFullName('ACME/APP/')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})

describe('repoFullNameFromCloneUrl', () => {
  it('parsea https con y sin .git', () => {
    expect(repoFullNameFromCloneUrl('https://github.com/Owner/Repo')).toBe('owner/repo')
    expect(repoFullNameFromCloneUrl('https://github.com/owner/repo.git')).toBe('owner/repo')
    expect(repoFullNameFromCloneUrl('https://github.com/owner/repo/')).toBe('owner/repo')
  })

  it('parsea ssh', () => {
    expect(repoFullNameFromCloneUrl('git@github.com:Owner/Repo.git')).toBe('owner/repo')
    expect(repoFullNameFromCloneUrl('ssh://git@github.com/owner/repo')).toBe('owner/repo')
  })

  it('devuelve vacío si la URL no es válida', () => {
    expect(repoFullNameFromCloneUrl('')).toBe('')
    expect(repoFullNameFromCloneUrl('not-a-url')).toBe('')
    expect(repoFullNameFromCloneUrl('https://gitlab.com/owner/repo')).toBe('')
  })
})
