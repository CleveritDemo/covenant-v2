import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { captureWorkspaceSnapshot, changedWorkspacePaths } from '../turnFileChanges'

describe('turn file changes', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-turn-diff-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('detects added, modified and deleted files while ignoring .iaterminal', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'))
    mkdirSync(join(cwd, '.iaterminal'))
    writeFileSync(join(cwd, 'src', 'modified.ts'), 'before')
    writeFileSync(join(cwd, 'src', 'deleted.ts'), 'delete me')
    const before = captureWorkspaceSnapshot(cwd)

    writeFileSync(join(cwd, 'src', 'modified.ts'), 'after')
    unlinkSync(join(cwd, 'src', 'deleted.ts'))
    writeFileSync(join(cwd, 'src', 'added.ts'), 'new')
    writeFileSync(join(cwd, '.iaterminal', 'changelog.md'), 'automatic')
    const after = captureWorkspaceSnapshot(cwd)

    expect(changedWorkspacePaths(before, after)).toEqual([
      'src/added.ts',
      'src/deleted.ts',
      'src/modified.ts',
    ])
  })

  it('does not report a file changed and then restored', () => {
    const cwd = tempCwd()
    writeFileSync(join(cwd, 'file.txt'), 'same')
    const before = captureWorkspaceSnapshot(cwd)
    writeFileSync(join(cwd, 'file.txt'), 'different')
    writeFileSync(join(cwd, 'file.txt'), 'same')

    expect(changedWorkspacePaths(before, captureWorkspaceSnapshot(cwd))).toEqual([])
  })
})
