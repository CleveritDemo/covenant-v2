import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { repoAndBranch } from '../gitSessionOps'

describe('repoAndBranch main repo name', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-git-session-repo-'))
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

  it('labels a delegation worktree with the main repo basename, not the worktree GUID', async () => {
    const repo = tempDir()
    initRepo(repo)
    const guid = 'e29cbe2a-e6f7-4c1b-8290-aaa68d9d8b72'
    const worktreePath = join(repo, '.gravity', 'worktrees', 'tab-1', guid)
    mkdirSync(join(repo, '.gravity', 'worktrees', 'tab-1'), { recursive: true })
    run(repo, ['worktree', 'add', '-b', `gravity/deleg/${guid}`, worktreePath])

    const labeled = await repoAndBranch(worktreePath)
    expect(labeled.repo).toBe(basename(repo))
    expect(labeled.branch).toBe(`gravity/deleg/${guid}`)
  })
})
