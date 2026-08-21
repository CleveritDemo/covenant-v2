import { describe, expect, it } from 'vitest'
import { resolveRepoDestName, sameRepoUrl } from '../orgWorkspaceClone'

describe('resolveRepoDestName', () => {
  it('usa folderName saneado', () => {
    expect(
      resolveRepoDestName({
        repoFullName: 'owner/repo-a',
        folderName: 'Custom_Dir.1',
      }),
    ).toEqual({ ok: true, destName: 'Custom_Dir.1' })
  })

  it('usa el último segmento de repoFullName', () => {
    expect(resolveRepoDestName({ repoFullName: 'owner/repo-a' })).toEqual({
      ok: true,
      destName: 'repo-a',
    })
  })

  it('rechaza folderName inválido', () => {
    expect(
      resolveRepoDestName({
        repoFullName: 'owner/repo-a',
        folderName: '../escape',
      }),
    ).toEqual({
      ok: false,
      error: 'invalid folder name for owner/repo-a: ../escape',
    })
  })
})

describe('sameRepoUrl', () => {
  it('considera https idénticos iguales', () => {
    expect(
      sameRepoUrl('https://github.com/owner/repo', 'https://github.com/owner/repo'),
    ).toBe(true)
  })

  it('ignora .git final en https', () => {
    expect(
      sameRepoUrl('https://github.com/owner/repo.git', 'https://github.com/owner/repo'),
    ).toBe(true)
  })

  it('ignora userinfo con token', () => {
    expect(
      sameRepoUrl(
        'https://x-access-token:SECRET@github.com/owner/repo.git',
        'https://github.com/owner/repo',
      ),
    ).toBe(true)
  })

  it('trata ssh y https del mismo repo como iguales', () => {
    expect(
      sameRepoUrl('git@github.com:owner/repo.git', 'https://github.com/owner/repo'),
    ).toBe(true)
  })

  it('distingue repos distintos del mismo host', () => {
    expect(
      sameRepoUrl('https://github.com/owner/repo-a', 'https://github.com/owner/repo-b'),
    ).toBe(false)
  })
})
