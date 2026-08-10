import { describe, expect, it } from 'vitest'
import {
  GIT_STATUS_LETTER,
  canGitStageEntry,
  filterGitEntries,
  canGitUnstageEntry,
  gitDisplayFileName,
  gitSplitDisplayPath,
  gitStatusKind,
  gitWorktreePath,
  hasGitStagedChanges,
  hasGitUnstagedChanges,
  isGitEntryFullyStaged,
  shortPathTail,
  splitGitFilesByArea,
  type GitStatusKind,
} from '../gitPathUtils'

describe('gitPathUtils', () => {
  it('shortPathTail keeps the last two segments', () => {
    expect(shortPathTail('/Users/rodrigoanti/Documents/covenant/rodrigoanti/covenant/covenant-v2'))
      .toBe('covenant/covenant-v2')
    expect(shortPathTail('C:\\Users\\me\\proj\\app')).toBe('proj/app')
    expect(shortPathTail('solo')).toBe('solo')
    expect(shortPathTail('')).toBe('')
  })
  it('gitWorktreePath uses destination on rename', () => {
    expect(gitWorktreePath({ status: 'R ', path: 'old.ts -> new.ts' })).toBe('new.ts')
  })

  it('isGitEntryFullyStaged detects staged-only entries', () => {
    expect(isGitEntryFullyStaged({ status: 'M ', path: 'a.ts' })).toBe(true)
    expect(isGitEntryFullyStaged({ status: 'MM', path: 'a.ts' })).toBe(false)
    expect(isGitEntryFullyStaged({ status: '??', path: 'a.ts' })).toBe(false)
  })

  it('canGitStageEntry allows untracked and unstaged', () => {
    expect(canGitStageEntry({ status: '??', path: 'a.ts' })).toBe(true)
    expect(canGitStageEntry({ status: ' M', path: 'a.ts' })).toBe(true)
    expect(canGitStageEntry({ status: 'M ', path: 'a.ts' })).toBe(false)
  })

  it('splitGitFilesByArea separates staged and unstaged', () => {
    const files = [
      { status: ' M', path: 'unstaged.ts' },
      { status: 'M ', path: 'staged.ts' },
      { status: 'MM', path: 'both.ts' },
      { status: '??', path: 'new.ts' },
    ]
    const { unstaged, staged } = splitGitFilesByArea(files)
    expect(unstaged.map(f => f.path)).toEqual(['unstaged.ts', 'both.ts', 'new.ts'])
    expect(staged.map(f => f.path)).toEqual(['staged.ts', 'both.ts'])
  })

  it('gitDisplayFileName shows basename', () => {
    expect(gitDisplayFileName({ status: 'M ', path: 'src/foo/bar.ts' })).toBe('bar.ts')
  })

  it('hasGitStagedChanges and hasGitUnstagedChanges', () => {
    expect(hasGitStagedChanges({ status: 'M ', path: 'a' })).toBe(true)
    expect(hasGitUnstagedChanges({ status: ' M', path: 'a' })).toBe(true)
    expect(hasGitStagedChanges({ status: '??', path: 'a' })).toBe(false)
    expect(hasGitUnstagedChanges({ status: '??', path: 'a' })).toBe(true)
  })

  it('canGitUnstageEntry mirrors staged index changes', () => {
    expect(canGitUnstageEntry({ status: 'M ', path: 'a' })).toBe(true)
    expect(canGitUnstageEntry({ status: '??', path: 'a' })).toBe(false)
    expect(canGitUnstageEntry({ status: ' M', path: 'a' })).toBe(false)
  })

  it('gitSplitDisplayPath separates directory and name', () => {
    expect(gitSplitDisplayPath({ status: 'M ', path: 'src/foo/bar.ts' })).toEqual({
      dir: 'src/foo/',
      name: 'bar.ts',
    })
    expect(gitSplitDisplayPath({ status: '??', path: 'top.md' })).toEqual({ dir: '', name: 'top.md' })
    // En renombres se muestra el destino.
    expect(gitSplitDisplayPath({ status: 'R ', path: 'a/old.ts -> b/new.ts' })).toEqual({
      dir: 'b/',
      name: 'new.ts',
    })
  })

  it('gitStatusKind reads the requested area', () => {
    expect(gitStatusKind({ status: '??', path: 'a' }, 'worktree')).toBe('untracked')
    expect(gitStatusKind({ status: 'A ', path: 'a' }, 'index')).toBe('added')
    // MD: modificado en índice, borrado en worktree.
    expect(gitStatusKind({ status: 'MD', path: 'a' }, 'index')).toBe('modified')
    expect(gitStatusKind({ status: 'MD', path: 'a' }, 'worktree')).toBe('deleted')
    expect(gitStatusKind({ status: 'R ', path: 'a -> b' }, 'index')).toBe('renamed')
    expect(gitStatusKind({ status: ' M', path: 'a' }, 'index')).toBe('other')
  })

  it('gitStatusKind flags conflicts on both sides', () => {
    for (const status of ['UU', 'AU', 'UD', 'DU', 'AA', 'DD']) {
      expect(gitStatusKind({ status, path: 'a' }, 'index')).toBe('conflict')
      expect(gitStatusKind({ status, path: 'a' }, 'worktree')).toBe('conflict')
    }
  })

  it('filterGitEntries matches the whole path, case-insensitive', () => {
    const files = [
      { status: ' M', path: 'src/renderer/App.tsx' },
      { status: '??', path: 'docs/README.md' },
      { status: 'R ', path: 'a/old.ts -> src/new.ts' },
    ]
    expect(filterGitEntries(files, 'src').map(f => f.path)).toEqual([
      'src/renderer/App.tsx',
      'a/old.ts -> src/new.ts',
    ])
    expect(filterGitEntries(files, 'README').map(f => f.path)).toEqual(['docs/README.md'])
    // Sin consulta no filtra; en renombres busca sobre el destino.
    expect(filterGitEntries(files, '  ')).toHaveLength(3)
    expect(filterGitEntries(files, 'old.ts')).toHaveLength(0)
  })

  it('every status kind has a letter', () => {
    const kinds: GitStatusKind[] = [
      'added',
      'modified',
      'deleted',
      'renamed',
      'copied',
      'typeChange',
      'untracked',
      'conflict',
      'other',
    ]
    for (const kind of kinds) expect(GIT_STATUS_LETTER[kind]).toBeTruthy()
  })
})
