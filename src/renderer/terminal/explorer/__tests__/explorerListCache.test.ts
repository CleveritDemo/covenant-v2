import { describe, expect, it } from 'vitest'
import type { FileExplorerEntry } from '@shared/fileExplorerTypes'
import { mergeListDirIntoCache, sortExplorerEntries } from '../explorerListCache'

describe('sortExplorerEntries', () => {
  it('puts directories first then sorts by name', () => {
    const entries: FileExplorerEntry[] = [
      { name: 'b.ts', relPath: 'b.ts', isDirectory: false },
      { name: 'a', relPath: 'a', isDirectory: true },
      { name: 'c', relPath: 'c', isDirectory: true },
    ]
    expect(sortExplorerEntries(entries).map(e => e.name)).toEqual(['a', 'c', 'b.ts'])
  })
})

describe('mergeListDirIntoCache', () => {
  it('stores the listed dir and merges prefetch without overwriting existing keys', () => {
    const existingChild: FileExplorerEntry[] = [
      { name: 'stale.ts', relPath: 'src/stale.ts', isDirectory: false },
    ]
    const cache = new Map<string, FileExplorerEntry[]>([['src', existingChild]])
    const next = mergeListDirIntoCache(cache, '', {
      ok: true,
      entries: [
        { name: 'src', relPath: 'src', isDirectory: true },
        { name: 'readme.md', relPath: 'readme.md', isDirectory: false },
      ],
      prefetched: {
        src: [
          { name: 'fresh.ts', relPath: 'src/fresh.ts', isDirectory: false },
        ],
        docs: [
          { name: 'a.md', relPath: 'docs/a.md', isDirectory: false },
        ],
      },
    })

    expect(next.get('')?.map(e => e.name)).toEqual(['src', 'readme.md'])
    // Existing cache for src is preserved
    expect(next.get('src')).toEqual(existingChild)
    expect(next.get('docs')?.map(e => e.name)).toEqual(['a.md'])
  })

  it('clears entries on failed list', () => {
    const cache = new Map<string, FileExplorerEntry[]>([
      ['src', [{ name: 'a.ts', relPath: 'src/a.ts', isDirectory: false }]],
    ])
    const next = mergeListDirIntoCache(cache, 'src', { ok: false, entries: [] })
    expect(next.get('src')).toEqual([])
  })
})
