import { describe, expect, it } from 'vitest'
import {
  ancestorRelPaths,
  buildNewRelPath,
  expandedPathsKey,
  filterRowsKeepingAncestors,
  isRelPathInside,
  pasteDestRelPath,
  pathsAffectOpenFile,
  remapChildRelPath,
  relPathFromCwd,
  resolveExplorerActionPaths,
  seedMultiSelect,
  sessionCwdFolderName,
} from '../explorerPathUtils'

describe('remapChildRelPath', () => {
  it('remaps exact match', () => {
    expect(remapChildRelPath('src', 'src', 'lib')).toBe('lib')
  })

  it('remaps child paths', () => {
    expect(remapChildRelPath('src/foo.ts', 'src', 'lib')).toBe('lib/foo.ts')
    expect(remapChildRelPath('src/nested/bar.ts', 'src', 'lib')).toBe('lib/nested/bar.ts')
  })

  it('returns null when prefix does not apply', () => {
    expect(remapChildRelPath('other/foo.ts', 'src', 'lib')).toBeNull()
  })
})

describe('buildNewRelPath', () => {
  it('combines parent and name', () => {
    expect(buildNewRelPath('foo.ts', 'src')).toBe('src/foo.ts')
    expect(buildNewRelPath('dir', '')).toBe('dir')
  })

  it('rejects invalid names', () => {
    expect(buildNewRelPath('..', 'src')).toBeNull()
    expect(buildNewRelPath('', 'src')).toBeNull()
  })
})

describe('expandedPathsKey', () => {
  it('is order-independent', () => {
    expect(expandedPathsKey(['b', 'a'])).toBe(expandedPathsKey(['a', 'b']))
  })
})

describe('pasteDestRelPath', () => {
  it('uses directory selection', () => {
    expect(pasteDestRelPath({ relPath: 'src', isDirectory: true })).toBe('src')
  })

  it('uses parent for file selection', () => {
    expect(pasteDestRelPath({ relPath: 'src/foo.ts', isDirectory: false })).toBe('src')
  })
})

describe('isRelPathInside', () => {
  it('returns true for same path', () => {
    expect(isRelPathInside('src', 'src')).toBe(true)
  })

  it('returns true when child is nested under parent', () => {
    expect(isRelPathInside('src', 'src/foo.ts')).toBe(true)
    expect(isRelPathInside('src', 'src/nested/bar.ts')).toBe(true)
  })

  it('returns false for unrelated paths', () => {
    expect(isRelPathInside('src', 'lib/foo.ts')).toBe(false)
    expect(isRelPathInside('src', 'srcfoo')).toBe(false)
  })

  it('returns false when parent is empty', () => {
    expect(isRelPathInside('', 'foo.ts')).toBe(false)
  })
})

describe('relPathFromCwd', () => {
  it('returns empty for same cwd', () => {
    expect(relPathFromCwd('/proj', '/proj')).toBe('')
  })

  it('returns relative segment', () => {
    expect(relPathFromCwd('/proj', '/proj/src')).toBe('src')
  })

  it('returns null outside tree', () => {
    expect(relPathFromCwd('/proj', '/other')).toBeNull()
  })
})

describe('resolveExplorerActionPaths', () => {
  it('uses multi-select when target is inside it', () => {
    expect(
      resolveExplorerActionPaths(new Set(['a.ts', 'b.ts']), 'a.ts', 'c.ts'),
    ).toEqual(['a.ts', 'b.ts'])
  })

  it('uses only target when target is outside multi-select', () => {
    expect(
      resolveExplorerActionPaths(new Set(['a.ts', 'b.ts']), 'c.ts', 'a.ts'),
    ).toEqual(['c.ts'])
  })

  it('falls back to target then selection', () => {
    expect(resolveExplorerActionPaths(new Set(), 'x.ts', 'y.ts')).toEqual(['x.ts'])
    expect(resolveExplorerActionPaths(new Set(), null, 'y.ts')).toEqual(['y.ts'])
    expect(resolveExplorerActionPaths(new Set(), null, null)).toEqual([])
  })
})

describe('seedMultiSelect', () => {
  it('seeds current selection when starting multi', () => {
    expect(seedMultiSelect(new Set(), 'a.ts', 'b.ts')).toEqual(new Set(['a.ts', 'b.ts']))
  })

  it('toggles clicked path when already in multi', () => {
    expect(seedMultiSelect(new Set(['a.ts', 'b.ts']), 'a.ts', 'b.ts')).toEqual(new Set(['a.ts']))
  })
})

describe('pathsAffectOpenFile', () => {
  it('detects open file and ancestors', () => {
    expect(pathsAffectOpenFile(['src'], 'src/a.ts')).toBe(true)
    expect(pathsAffectOpenFile(['src/a.ts'], 'src/a.ts')).toBe(true)
    expect(pathsAffectOpenFile(['lib'], 'src/a.ts')).toBe(false)
  })
})

describe('filterRowsKeepingAncestors', () => {
  it('keeps ancestors of matches', () => {
    const rows = [
      { entry: { relPath: 'src', name: 'src' } },
      { entry: { relPath: 'src/foo.ts', name: 'foo.ts' } },
      { entry: { relPath: 'lib', name: 'lib' } },
    ]
    const filtered = filterRowsKeepingAncestors(rows, 'foo')
    expect(filtered.map(r => r.entry.relPath)).toEqual(['src', 'src/foo.ts'])
  })
})

describe('ancestorRelPaths', () => {
  it('returns parents', () => {
    expect(ancestorRelPaths('a/b/c.ts')).toEqual(['a', 'a/b'])
    expect(ancestorRelPaths('file.ts')).toEqual([])
  })
})

describe('sessionCwdFolderName', () => {
  it('returns only the basename', () => {
    expect(sessionCwdFolderName('/Users/me/projects/ia_terminal')).toBe('ia_terminal')
    expect(sessionCwdFolderName('/tmp/')).toBe('tmp')
    expect(sessionCwdFolderName('C:\\Users\\me\\repo')).toBe('repo')
  })

  it('returns em dash when empty', () => {
    expect(sessionCwdFolderName('')).toBe('—')
    expect(sessionCwdFolderName(null)).toBe('—')
  })
})
