import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { gitListReposWithRemote } from '../gitSessionOps'

describe('gitListReposWithRemote', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-git-list-remote-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  const gitInit = (dir: string): void => {
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' })
  }

  it('returns origin url and normalized repoFullName', () => {
    const root = tempDir()
    gitInit(root)
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/Acme/Repo.git'], {
      cwd: root,
      stdio: 'ignore',
    })

    const repos = gitListReposWithRemote(root)
    expect(repos).toHaveLength(1)
    expect(repos[0]?.repoFullName).toBe('acme/repo')
    expect(repos[0]?.remoteUrl).toBe('https://github.com/Acme/Repo.git')
  })

  it('returns empty remoteUrl and repoFullName when there is no origin', () => {
    const root = tempDir()
    gitInit(root)

    const repos = gitListReposWithRemote(root)
    expect(repos).toHaveLength(1)
    expect(repos[0]?.remoteUrl).toBe('')
    expect(repos[0]?.repoFullName).toBe('')
  })

  it('returns both child repos of a container', () => {
    const root = tempDir()
    const a = join(root, 'alpha')
    const b = join(root, 'beta')
    mkdirSync(a)
    mkdirSync(b)
    gitInit(a)
    gitInit(b)

    const repos = gitListReposWithRemote(root)
    expect(repos.map(repo => repo.name).sort()).toEqual(['alpha', 'beta'])
    expect(repos.map(repo => repo.path).sort()).toEqual([a, b].sort())
  })
})
