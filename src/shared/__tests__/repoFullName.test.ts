import { describe, expect, it } from 'vitest'
import { normalizeRepoFullName } from '../repoFullName'

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
