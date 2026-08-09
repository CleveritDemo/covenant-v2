import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { gitDiffFile, gitDiscardFile } from '../gitSessionOps'

/** Repo real con un archivo commiteado, para no adivinar la salida de git. */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'gravity-git-diff-'))
  const git = (...args: string[]): void => {
    execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  }
  git('init', '-q')
  git('config', 'user.email', 'test@example.com')
  git('config', 'user.name', 'Test')
  git('config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'tracked.txt'), 'uno\ndos\n')
  git('add', '-A')
  git('commit', '-qm', 'inicial')
  return dir
}

describe('gitDiffFile / gitDiscardFile', () => {
  const dirs: string[] = []
  const repo = (): string => {
    const dir = makeRepo()
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('diffs the worktree change of a tracked file', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'tracked.txt'), 'uno\nDOS\n')

    const r = await gitDiffFile(dir, 'tracked.txt', 'worktree')
    expect(r.ok).toBe(true)
    expect(r.stdout).toContain('-dos')
    expect(r.stdout).toContain('+DOS')
  })

  it('diffs the index separately from the worktree', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'tracked.txt'), 'uno\nDOS\n')
    execFileSync('git', ['add', 'tracked.txt'], { cwd: dir, stdio: 'pipe' })

    expect((await gitDiffFile(dir, 'tracked.txt', 'staged')).stdout).toContain('+DOS')
    // Ya no queda nada sin preparar.
    expect((await gitDiffFile(dir, 'tracked.txt', 'worktree')).stdout).toBe('')
  })

  it('shows an untracked file as additions instead of an empty diff', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'nuevo.txt'), 'hola\n')

    const r = await gitDiffFile(dir, 'nuevo.txt', 'untracked')
    // `--no-index` sale con 1 cuando hay diferencias: aquí es el caso normal.
    expect(r.ok).toBe(true)
    expect(r.stdout).toContain('+hola')
  })

  it('rejects invalid paths before running git', async () => {
    const dir = repo()
    for (const bad of ['', '   ', '/etc/passwd']) {
      expect((await gitDiffFile(dir, bad, 'worktree')).errorCode).toBe('CWD_INVALID')
      expect((await gitDiscardFile(dir, bad, false)).errorCode).toBe('CWD_INVALID')
    }
  })

  it('discards a tracked file back to HEAD without touching the index', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'tracked.txt'), 'uno\nDOS\n')

    const r = await gitDiscardFile(dir, 'tracked.txt', false)
    expect(r.ok).toBe(true)
    expect(readFileSync(join(dir, 'tracked.txt'), 'utf8')).toBe('uno\ndos\n')
  })

  it('deletes an untracked file from disk', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'basura.txt'), 'x\n')

    const r = await gitDiscardFile(dir, 'basura.txt', true)
    expect(r.ok).toBe(true)
    expect(existsSync(join(dir, 'basura.txt'))).toBe(false)
    // El archivo commiteado sigue donde estaba.
    expect(existsSync(join(dir, 'tracked.txt'))).toBe(true)
  })

  it('does not delete a tracked file when asked to discard it as untracked', async () => {
    const dir = repo()
    writeFileSync(join(dir, 'tracked.txt'), 'uno\nDOS\n')

    await gitDiscardFile(dir, 'tracked.txt', true)
    expect(existsSync(join(dir, 'tracked.txt'))).toBe(true)
  })
})
