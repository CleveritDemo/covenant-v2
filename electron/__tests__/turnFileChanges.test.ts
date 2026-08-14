import { chmodSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execFileSync } from 'child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  beginTurnFileBaseline,
  captureWorkspaceSnapshot,
  captureWorkspaceSnapshotMetadata,
  changedWorkspacePaths,
  resolveTurnChangedPaths,
} from '../turnFileChanges'
import { PROJECT_DIR } from '../../src/shared/projectDir'

describe('turn file changes', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-turn-diff-'))
    dirs.push(dir)
    return dir
  }
  const gitInit = (cwd: string): void => {
    execFileSync('git', ['init'], { cwd, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd, stdio: 'ignore' })
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd, stdio: 'ignore' })
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('detects added, modified and deleted files while ignoring the project dir', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, 'src'))
    mkdirSync(join(cwd, PROJECT_DIR))
    writeFileSync(join(cwd, 'src', 'modified.ts'), 'before')
    writeFileSync(join(cwd, 'src', 'deleted.ts'), 'delete me')
    const before = captureWorkspaceSnapshot(cwd)

    writeFileSync(join(cwd, 'src', 'modified.ts'), 'after')
    unlinkSync(join(cwd, 'src', 'deleted.ts'))
    writeFileSync(join(cwd, 'src', 'added.ts'), 'new')
    writeFileSync(join(cwd, PROJECT_DIR, 'changelog.md'), 'automatic')
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

  it('survives unreadable directories such as .Trash without throwing', () => {
    const cwd = tempCwd()
    writeFileSync(join(cwd, 'ok.txt'), 'visible')
    mkdirSync(join(cwd, '.Trash'))
    writeFileSync(join(cwd, '.Trash', 'secret.txt'), 'denied')
    // Simula EPERM: quita permisos de listado al directorio protegido.
    chmodSync(join(cwd, '.Trash'), 0)

    expect(() => captureWorkspaceSnapshot(cwd)).not.toThrow()
    const snapshot = captureWorkspaceSnapshot(cwd)
    expect(snapshot.has('ok.txt')).toBe(true)
    expect([...snapshot.keys()].some(path => path.includes('.Trash'))).toBe(false)

    chmodSync(join(cwd, '.Trash'), 0o700)
  })

  it('resolveTurnChangedPaths with git baseline includes edited tracked file', () => {
    const cwd = tempCwd()
    gitInit(cwd)
    writeFileSync(join(cwd, 'tracked.ts'), 'before')
    execFileSync('git', ['add', 'tracked.ts'], { cwd, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'init'], { cwd, stdio: 'ignore' })
    const baseline = beginTurnFileBaseline(cwd)
    writeFileSync(join(cwd, 'tracked.ts'), 'after')

    expect(resolveTurnChangedPaths(cwd, baseline, null)).toEqual(['tracked.ts'])
  })

  it('resolveTurnChangedPaths with git baseline omits unedited tracked file', () => {
    const cwd = tempCwd()
    gitInit(cwd)
    writeFileSync(join(cwd, 'stable.ts'), 'same')
    execFileSync('git', ['add', 'stable.ts'], { cwd, stdio: 'ignore' })
    execFileSync('git', ['commit', '-m', 'init'], { cwd, stdio: 'ignore' })
    const baseline = beginTurnFileBaseline(cwd)

    expect(resolveTurnChangedPaths(cwd, baseline, null)).toEqual([])
  })

  it('resolveTurnChangedPaths without git detects edit via walkBefore metadata', () => {
    const cwd = tempCwd()
    writeFileSync(join(cwd, 'file.txt'), 'before')
    const baseline = beginTurnFileBaseline(cwd)
    const walkBefore = captureWorkspaceSnapshotMetadata(cwd)
    writeFileSync(join(cwd, 'file.txt'), 'after')

    expect(resolveTurnChangedPaths(cwd, baseline, walkBefore)).toEqual(['file.txt'])
  })

  it('resolveTurnChangedPaths without git and null walkBefore returns empty list', () => {
    const cwd = tempCwd()
    writeFileSync(join(cwd, 'file.txt'), 'before')
    const baseline = beginTurnFileBaseline(cwd)
    writeFileSync(join(cwd, 'file.txt'), 'after')

    expect(resolveTurnChangedPaths(cwd, baseline, null)).toEqual([])
  })
})
