import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  gitCurrentBranch,
  gitWorktreeAbortMerge,
  gitWorktreeAdd,
  gitWorktreeList,
  gitWorktreeMerge,
  gitWorktreeRemove,
} from '../gitWorktreeOps'

describe('gitWorktreeOps', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-git-worktree-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const run = (cwd: string, args: string[]): string => {
    return execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf-8')
  }

  const initRepo = (dir: string): void => {
    run(dir, ['init'])
    run(dir, ['config', 'user.email', 'test@example.com'])
    run(dir, ['config', 'user.name', 'Test'])
    writeFileSync(join(dir, 'README.md'), 'hello\n', 'utf-8')
    run(dir, ['add', '-A'])
    run(dir, ['commit', '-m', 'initial commit'])
  }

  it('gitCurrentBranch reports the checked out branch', async () => {
    const repo = tempDir()
    initRepo(repo)
    const result = await gitCurrentBranch(repo)
    expect(result.ok).toBe(true)
    expect(result.branch.length).toBeGreaterThan(0)
  })

  it('gitCurrentBranch fails for non-repo path', async () => {
    const dir = tempDir()
    const result = await gitCurrentBranch(dir)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  const realpathOrResolve = (p: string): string => {
    try {
      return realpathSync(p)
    } catch {
      return resolve(p)
    }
  }

  // Los worktrees deben quedar dentro de `<repo>/.gravity/worktrees/` (containment check).
  const wtPath = (repo: string, name: string): string => join(repo, '.gravity', 'worktrees', name)

  it('gitWorktreeAdd creates a worktree and branch, gitWorktreeList reflects it', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const worktreePath = wtPath(repo, 'test')
    const add = await gitWorktreeAdd(repo, {
      worktreePath,
      branch: 'feature/test-branch',
      fromRef: baseBranch,
    })
    expect(add.ok).toBe(true)

    const list = await gitWorktreeList(repo)
    const found = list.find(entry => realpathOrResolve(entry.path) === realpathOrResolve(worktreePath))
    expect(found).toBeTruthy()
    expect(found?.branch).toBe('feature/test-branch')
  })

  it('gitWorktreeMerge integrates a clean branch without conflicts', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const worktreePath = wtPath(repo, 'merge')
    await gitWorktreeAdd(repo, { worktreePath, branch: 'feature/merge-clean', fromRef: baseBranch })

    writeFileSync(join(worktreePath, 'new-file.txt'), 'content\n', 'utf-8')
    run(worktreePath, ['add', '-A'])
    run(worktreePath, ['commit', '-m', 'add new file'])

    const merge = await gitWorktreeMerge(repo, { branch: 'feature/merge-clean', message: 'merge clean' })
    expect(merge.ok).toBe(true)
    expect(merge.conflicted).toBe(false)
    expect(merge.conflictFiles).toEqual([])
  })

  it('gitWorktreeMerge reports conflicted with conflictFiles on a real conflict', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const worktreePath = wtPath(repo, 'conflict')
    await gitWorktreeAdd(repo, { worktreePath, branch: 'feature/merge-conflict', fromRef: baseBranch })

    // Cambia README en la rama del worktree.
    writeFileSync(join(worktreePath, 'README.md'), 'from branch\n', 'utf-8')
    run(worktreePath, ['add', '-A'])
    run(worktreePath, ['commit', '-m', 'branch change'])

    // Cambia README en la rama base para forzar conflicto.
    writeFileSync(join(repo, 'README.md'), 'from base\n', 'utf-8')
    run(repo, ['add', '-A'])
    run(repo, ['commit', '-m', 'base change'])

    const merge = await gitWorktreeMerge(repo, { branch: 'feature/merge-conflict', message: 'merge conflict' })
    expect(merge.ok).toBe(false)
    expect(merge.conflicted).toBe(true)
    expect(merge.conflictFiles).toContain('README.md')

    const abort = await gitWorktreeAbortMerge(repo)
    expect(abort.ok).toBe(true)
  })

  it('gitWorktreeAbortMerge is idempotent when there is no merge in progress', async () => {
    const repo = tempDir()
    initRepo(repo)
    const abort = await gitWorktreeAbortMerge(repo)
    expect(abort.ok).toBe(true)
  })

  it('gitWorktreeRemove cleans up worktree and branch', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const worktreePath = wtPath(repo, 'remove')
    await gitWorktreeAdd(repo, { worktreePath, branch: 'feature/to-remove', fromRef: baseBranch })

    const remove = await gitWorktreeRemove(repo, {
      worktreePath,
      branch: 'feature/to-remove',
      force: true,
    })
    expect(remove.ok).toBe(true)
    expect(remove.steps.removed).toBe(true)
    expect(remove.steps.branchDeleted).toBe(true)
    expect(remove.steps.pruned).toBe(true)

    const list = await gitWorktreeList(repo)
    expect(list.some(entry => realpathOrResolve(entry.path) === realpathOrResolve(worktreePath))).toBe(false)
  })

  it('rejects worktree paths containing ".."', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const add = await gitWorktreeAdd(repo, {
      worktreePath: `${repo}/../escape-attempt`,
      branch: 'feature/escape',
      fromRef: baseBranch,
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('rejects branch names containing ".."', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const add = await gitWorktreeAdd(repo, {
      worktreePath: wtPath(repo, 'bad-branch'),
      branch: 'feature/../escape',
      fromRef: baseBranch,
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('gitWorktreeList returns empty for a non-repo directory', async () => {
    const dir = tempDir()
    const list = await gitWorktreeList(dir)
    expect(list).toEqual([])
  })

  // --- Regresión: inyección de flags (QA bloqueante) ---
  // Todos estos casos deben rechazarse por validación, sin llegar a spawnear git
  // (verificado indirectamente: no dejan ramas/worktrees creados y responden ok:false).

  it('rejects gitWorktreeAdd when branch looks like a flag ("--detach")', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const add = await gitWorktreeAdd(repo, {
      worktreePath: wtPath(repo, 'flag-branch'),
      branch: '--detach',
      fromRef: baseBranch,
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('rejects gitWorktreeAdd when fromRef looks like a flag ("--squash")', async () => {
    const repo = tempDir()
    initRepo(repo)

    const add = await gitWorktreeAdd(repo, {
      worktreePath: wtPath(repo, 'flag-ref'),
      branch: 'feature/flag-ref',
      fromRef: '--squash',
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('rejects gitWorktreeAdd when fromRef looks like a flag ("--force")', async () => {
    const repo = tempDir()
    initRepo(repo)

    const add = await gitWorktreeAdd(repo, {
      worktreePath: wtPath(repo, 'flag-ref-force'),
      branch: 'feature/flag-ref-force',
      fromRef: '--force',
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('rejects gitWorktreeAdd when worktreePath basename looks like a flag ("-foo")', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const add = await gitWorktreeAdd(repo, {
      worktreePath: join(repo, '.gravity', 'worktrees', '-foo'),
      branch: 'feature/dash-basename',
      fromRef: baseBranch,
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('rejects gitWorktreeAdd when branch is a lone dash flag ("-x")', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const add = await gitWorktreeAdd(repo, {
      worktreePath: wtPath(repo, 'dash-branch'),
      branch: '-x',
      fromRef: baseBranch,
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('rejects gitWorktreeAdd when worktreePath resolves outside .gravity/worktrees/', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch

    const add = await gitWorktreeAdd(repo, {
      worktreePath: join(repo, 'outside-worktrees'),
      branch: 'feature/outside',
      fromRef: baseBranch,
    })
    expect(add.ok).toBe(false)
    expect(add.error).toBeTruthy()
  })

  it('rejects gitWorktreeMerge when branch looks like a flag ("--detach")', async () => {
    const repo = tempDir()
    initRepo(repo)

    const merge = await gitWorktreeMerge(repo, { branch: '--detach', message: 'attempted injection' })
    expect(merge.ok).toBe(false)
    expect(merge.conflicted).toBe(false)
  })

  it('accepts legitimate branch/fromRef values (feature/x, main, SHA) without false positives', async () => {
    const repo = tempDir()
    initRepo(repo)
    const baseBranch = (await gitCurrentBranch(repo)).branch
    const headSha = run(repo, ['rev-parse', 'HEAD']).trim()

    const addFromBranch = await gitWorktreeAdd(repo, {
      worktreePath: wtPath(repo, 'legit-branch-name'),
      branch: 'feature/x',
      fromRef: baseBranch,
    })
    expect(addFromBranch.ok).toBe(true)

    const addFromSha = await gitWorktreeAdd(repo, {
      worktreePath: wtPath(repo, 'legit-sha'),
      branch: 'feature/from-sha',
      fromRef: headSha,
    })
    expect(addFromSha.ok).toBe(true)

    const merge = await gitWorktreeMerge(repo, { branch: 'feature/x', message: 'merge legit branch' })
    expect(merge.ok).toBe(true)
  })
})
