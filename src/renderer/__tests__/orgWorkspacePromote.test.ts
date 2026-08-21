import { describe, expect, it } from 'vitest'
import {
  defaultPromotedWorkspaceName,
  normalizeGitHubCloneUrl,
  promoteLocalWorkspaceToOrg,
  promoteReposFromDetected,
  type PromoteLocalWorkspaceDeps,
  type PromotePhase,
  type PromoteRepoInput,
} from '../orgWorkspacePromote'

function recordingDeps(overrides: Partial<PromoteLocalWorkspaceDeps> = {}) {
  const calls: string[] = []
  const phases: PromotePhase[] = []
  const inner: PromoteLocalWorkspaceDeps = {
    createWorkspace: async () => ({ ok: true, workspaceId: 'ws-1' }),
    addRepo: async () => ({ ok: true }),
    upload: async () => ({ ok: true }),
    pushWiki: async () => ({ ok: true }),
    ...overrides,
  }
  const deps: PromoteLocalWorkspaceDeps = {
    createWorkspace: async (...args) => {
      calls.push('create')
      return inner.createWorkspace(...args)
    },
    addRepo: async (...args) => {
      calls.push(`addRepo:${args[2].position}:${args[2].repoFullName}`)
      return inner.addRepo(...args)
    },
    upload: async () => {
      calls.push('upload')
      return inner.upload('acme', 'ws-1', '/proj')
    },
    pushWiki: async () => {
      calls.push('pushWiki')
      return inner.pushWiki('acme', 'ws-1', '/proj')
    },
    onPhase: (phase) => {
      phases.push(phase)
      inner.onPhase?.(phase)
    },
    shouldCancel: inner.shouldCancel,
  }
  return { deps, calls, phases }
}

const twoRepos: readonly PromoteRepoInput[] = [
  { repoFullName: 'acme/one', cloneUrl: 'git@github.com:acme/one.git' },
  { repoFullName: 'acme/two', cloneUrl: 'git@github.com:acme/two.git' },
]

const happyParams = {
  orgSlug: 'acme',
  workspaceName: 'Proyecto',
  cwd: '/proj',
  repos: twoRepos,
}

describe('promoteLocalWorkspaceToOrg', () => {
  it('camino feliz: create → repos → upload → wiki y reposAdded', async () => {
    const { deps, calls, phases } = recordingDeps()
    const result = await promoteLocalWorkspaceToOrg(happyParams, deps)
    expect(result).toEqual({
      ok: true,
      workspaceId: 'ws-1',
      reposAdded: 2,
      reposFailed: [],
    })
    expect(phases).toEqual(['create', 'repos', 'upload', 'wiki'])
    expect(calls).toEqual([
      'create',
      'addRepo:0:acme/one',
      'addRepo:1:acme/two',
      'upload',
      'pushWiki',
    ])
  })

  it('si create falla no llama upload ni pushWiki', async () => {
    const { deps, calls } = recordingDeps({
      createWorkspace: async () => ({ ok: false, error: 'nope' }),
    })
    const result = await promoteLocalWorkspaceToOrg(happyParams, deps)
    expect(result).toEqual({ ok: false, stage: 'create', error: 'nope' })
    expect(calls).toEqual(['create'])
  })

  it('un addRepo que falla no aborta: ok true y reposFailed', async () => {
    const { deps, calls } = recordingDeps({
      addRepo: async (_org, _ws, repo) =>
        repo.repoFullName === 'acme/one'
          ? { ok: false, error: 'denied' }
          : { ok: true },
    })
    const result = await promoteLocalWorkspaceToOrg(happyParams, deps)
    expect(result).toEqual({
      ok: true,
      workspaceId: 'ws-1',
      reposAdded: 1,
      reposFailed: ['acme/one'],
    })
    expect(calls).toEqual([
      'create',
      'addRepo:0:acme/one',
      'addRepo:1:acme/two',
      'upload',
      'pushWiki',
    ])
  })

  it('upload ok:false corta en stage upload y no llama pushWiki', async () => {
    const { deps, calls } = recordingDeps({
      upload: async () => ({ ok: false, error: 'disk full' }),
    })
    const result = await promoteLocalWorkspaceToOrg(happyParams, deps)
    expect(result).toEqual({
      ok: false,
      stage: 'upload',
      error: 'disk full',
      workspaceId: 'ws-1',
    })
    expect(calls).toContain('upload')
    expect(calls).not.toContain('pushWiki')
  })

  it('pushWiki ok:false corta en stage wiki con workspaceId', async () => {
    const { deps, calls } = recordingDeps({
      pushWiki: async () => ({ ok: false, error: 'wiki boom' }),
    })
    const result = await promoteLocalWorkspaceToOrg(happyParams, deps)
    expect(result).toEqual({
      ok: false,
      stage: 'wiki',
      error: 'wiki boom',
      workspaceId: 'ws-1',
    })
    expect(calls).toContain('pushWiki')
  })

  it('shouldCancel true tras create → cancelled, stage repos', async () => {
    let created = false
    const { deps, calls } = recordingDeps({
      createWorkspace: async () => {
        created = true
        return { ok: true, workspaceId: 'ws-1' }
      },
      shouldCancel: () => created,
    })
    const result = await promoteLocalWorkspaceToOrg(happyParams, deps)
    expect(result).toEqual({
      ok: false,
      stage: 'repos',
      error: 'cancelled',
      cancelled: true,
      workspaceId: 'ws-1',
    })
    expect(calls).toEqual(['create'])
  })
})

describe('helpers puros', () => {
  it('defaultPromotedWorkspaceName es el último segmento sin barras finales', () => {
    expect(defaultPromotedWorkspaceName('/Users/me/proyecto/')).toBe('proyecto')
    expect(defaultPromotedWorkspaceName('  /Users/me/proyecto  ')).toBe('proyecto')
    expect(defaultPromotedWorkspaceName('/')).toBe('')
    expect(defaultPromotedWorkspaceName('')).toBe('')
  })

  it('promoteReposFromDetected descarta sin remoto y usa basename del path', () => {
    expect(
      promoteReposFromDetected([
        { name: 'root', path: '/ws', remoteUrl: 'git@gh:a/root.git', repoFullName: 'a/root' },
        { name: 'api', path: '/ws/packages/api', remoteUrl: 'git@gh:a/api.git', repoFullName: 'a/api' },
        { name: 'orphan', path: '/ws/orphan', remoteUrl: '', repoFullName: '' },
        { name: 'nourl', path: '/ws/x', remoteUrl: '', repoFullName: 'a/x' },
      ]),
    ).toEqual([
      { repoFullName: 'a/root', cloneUrl: 'git@gh:a/root.git', folderName: 'ws' },
      { repoFullName: 'a/api', cloneUrl: 'git@gh:a/api.git', folderName: 'api' },
    ])
  })

  it('promoteReposFromDetected normaliza alias ssh de github a https', () => {
    expect(
      promoteReposFromDetected([
        {
          name: 'rimay',
          path: '/Users/me/rimay-platform',
          remoteUrl: 'git@github-credicorp:credicorp-internal/brd-rimay-platform.git',
          repoFullName: 'credicorp-internal/brd-rimay-platform',
        },
      ]),
    ).toEqual([
      {
        repoFullName: 'credicorp-internal/brd-rimay-platform',
        cloneUrl: 'https://github.com/credicorp-internal/brd-rimay-platform.git',
        folderName: 'rimay-platform',
      },
    ])
  })
})

describe('normalizeGitHubCloneUrl', () => {
  it.each([
    [
      'git@github-credicorp:credicorp-internal/brd-rimay-platform.git',
      'credicorp-internal/brd-rimay-platform',
      'https://github.com/credicorp-internal/brd-rimay-platform.git',
    ],
    [
      'git@github.com:Owner/Repo.git',
      'Owner/Repo',
      'https://github.com/Owner/Repo.git',
    ],
    [
      'ssh://git@github.com/o/r.git',
      'o/r',
      'https://github.com/o/r.git',
    ],
    [
      'https://github.com/acme/pkg.git',
      'acme/pkg',
      'https://github.com/acme/pkg.git',
    ],
    [
      'git@bitbucket.org:o/r.git',
      'o/r',
      'git@bitbucket.org:o/r.git',
    ],
    [
      'git@gitlab-work:o/r.git',
      'o/r',
      'git@gitlab-work:o/r.git',
    ],
    [
      'git@github.com:Owner/Repo.git',
      '',
      'git@github.com:Owner/Repo.git',
    ],
    [
      'git@github.com:Owner/Repo.git',
      'nobarra',
      'git@github.com:Owner/Repo.git',
    ],
    [
      'git@github.com:Owner/Repo.git',
      'Owner/Repo.git',
      'https://github.com/Owner/Repo.git',
    ],
  ])('normaliza %j + %j → %j', (remoteUrl, repoFullName, expected) => {
    expect(normalizeGitHubCloneUrl(remoteUrl, repoFullName)).toBe(expected)
  })
})
