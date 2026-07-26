import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { gitCollectUniqueRepos, gitListRepos } from '../gitSessionOps'

describe('gitListRepos', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-git-list-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('includes root when it has .git plus immediate child repos only', () => {
    const root = tempDir()
    mkdirSync(join(root, '.git'))
    mkdirSync(join(root, 'service', '.git'), { recursive: true })
    mkdirSync(join(root, 'service', 'nested', '.git'), { recursive: true })
    mkdirSync(join(root, 'docs'))

    const repos = gitListRepos(root)
    expect(repos.map(repo => ({ name: repo.name, path: repo.path })).sort((a, b) => (
      a.path.localeCompare(b.path)
    ))).toEqual([
      { name: basenameOf(root), path: root },
      { name: 'service', path: join(root, 'service') },
    ].sort((a, b) => a.path.localeCompare(b.path)))
  })

  it('lists only immediate subdirs with .git and skips nested deeper ones', () => {
    const root = tempDir()
    mkdirSync(join(root, 'frontend', '.git'), { recursive: true })
    mkdirSync(join(root, 'backend', '.git'), { recursive: true })
    mkdirSync(join(root, 'frontend', 'nested', '.git'), { recursive: true })
    mkdirSync(join(root, 'plain'))

    const repos = gitListRepos(root)
    expect(repos.map(repo => repo.name).sort()).toEqual(['backend', 'frontend'])
    expect(repos.map(repo => repo.path).sort()).toEqual([
      join(root, 'backend'),
      join(root, 'frontend'),
    ].sort())
  })

  it('treats .git file marker as a repo (worktree style)', () => {
    const root = tempDir()
    writeFileSync(join(root, '.git'), 'gitdir: /tmp/somewhere\n', 'utf8')
    const repos = gitListRepos(root)
    expect(repos).toEqual([{ name: basenameOf(root), path: root }])
  })

  it('returns empty for invalid path', () => {
    expect(gitListRepos(join(tmpdir(), 'missing-ia-terminal-git-xyz'))).toEqual([])
  })
})

describe('gitCollectUniqueRepos', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-git-collect-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const gitInit = (dir: string): void => {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  }

  it('dedupes the same root from projectFolder and terminal cwd', async () => {
    const root = tempDir()
    gitInit(root)
    mkdirSync(join(root, 'src'), { recursive: true })

    const repos = await gitCollectUniqueRepos([root, join(root, 'src')])
    expect(repos).toHaveLength(1)
    expect(repos[0]?.path).toBe(realpathOrResolve(root))
    expect(repos[0]?.name).toBe(basenameOf(realpathOrResolve(root)))
  })

  it('returns length 1 when only one repo exists', async () => {
    const root = tempDir()
    gitInit(root)
    const repos = await gitCollectUniqueRepos([root])
    expect(repos).toHaveLength(1)
    expect(repos[0]?.path).toBe(realpathOrResolve(root))
  })

  it('skips nested 2-level repo unless a terminal cwd is inside it', async () => {
    const project = tempDir()
    gitInit(project)
    const nested = join(project, 'packages', 'api')
    mkdirSync(nested, { recursive: true })
    gitInit(nested)

    const fromProjectOnly = await gitCollectUniqueRepos([project])
    expect(fromProjectOnly.map(repo => repo.path).sort()).toEqual([realpathOrResolve(project)].sort())

    const withTerminalCwd = await gitCollectUniqueRepos([project, nested])
    expect(withTerminalCwd.map(repo => repo.path).sort()).toEqual([
      realpathOrResolve(nested),
      realpathOrResolve(project),
    ].sort())
  })
})

function basenameOf(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() ?? path
}

function realpathOrResolve(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return resolve(path)
  }
}
