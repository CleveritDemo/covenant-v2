import { describe, expect, it } from 'vitest'
import { githubIssueFileStem, githubIssueRefFor, parseGithubIssueToken } from '../githubIssue'

describe('parseGithubIssueToken', () => {
  it('acepta un número suelto', () => {
    expect(parseGithubIssueToken('123')).toEqual({ number: 123 })
    expect(parseGithubIssueToken('  123  ')).toEqual({ number: 123 })
  })

  it('acepta el sigil # delante del número', () => {
    expect(parseGithubIssueToken('#123')).toEqual({ number: 123 })
  })

  it('acepta owner/repo#number', () => {
    expect(parseGithubIssueToken('CleveritDemo/covenant-v2#86'))
      .toEqual({ repoFullName: 'CleveritDemo/covenant-v2', number: 86 })
  })

  it('lo que no es un token de issue devuelve null', () => {
    expect(parseGithubIssueToken('')).toBeNull()
    expect(parseGithubIssueToken('#')).toBeNull()
    expect(parseGithubIssueToken('abc')).toBeNull()
    expect(parseGithubIssueToken('owner#123')).toBeNull()
    expect(parseGithubIssueToken('owner/repo#')).toBeNull()
    expect(parseGithubIssueToken('12.5')).toBeNull()
  })
})

describe('githubIssueRefFor', () => {
  it('los campos explícitos mandan', () => {
    expect(githubIssueRefFor({
      issueNumber: 7,
      repoFullName: ' acme/app ',
      fileName: 'github/other-repo-99.md',
    })).toEqual({ repoFullName: 'acme/app', number: 7 })
  })

  it('sin issueNumber saca SOLO el número del fileName, no el repo', () => {
    expect(githubIssueRefFor({ fileName: 'github/CleveritDemo-covenant-v2-86.md' }))
      .toEqual({ repoFullName: '', number: 86 })
  })

  it('acepta separadores de Windows', () => {
    expect(githubIssueRefFor({ fileName: 'github\\acme-app-12.md' }))
      .toEqual({ repoFullName: '', number: 12 })
  })

  it('un fileName que es solo el número también vale', () => {
    expect(githubIssueRefFor({ fileName: 'github/42.md' }))
      .toEqual({ repoFullName: '', number: 42 })
  })

  it('sin nada resoluble, número 0 y repo vacío', () => {
    expect(githubIssueRefFor({})).toEqual({ repoFullName: '', number: 0 })
    expect(githubIssueRefFor({ issueNumber: 0, repoFullName: '  ' }))
      .toEqual({ repoFullName: '', number: 0 })
  })
})

describe('githubIssueFileStem', () => {
  it('con repo y número arma owner-repo-number', () => {
    expect(githubIssueFileStem({ repoFullName: 'acme/app', issueNumber: 12 }))
      .toBe('acme-app-12')
  })

  it('sin repo cae al stem del archivo', () => {
    expect(githubIssueFileStem({ fileName: 'github/acme-app-12.md' })).toBe('acme-app-12')
  })
})
