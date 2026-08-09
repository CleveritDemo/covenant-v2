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

describe('mergeListDirIntoCache: identidad estable', () => {
  const entries = [
    { name: 'src', relPath: 'src', isDirectory: true },
    { name: 'main.rs', relPath: 'main.rs', isDirectory: false },
  ]

  it('devuelve el MISMO Map cuando el listado no cambió', () => {
    // `visibleRows` es un useMemo sobre este Map: devolver uno nuevo rehace la
    // lista entera de filas, y con el watcher de fs eso es una ráfaga de
    // recomputados por interacción — el parpadeo del árbol.
    const first = mergeListDirIntoCache(new Map(), '', { ok: true, entries })
    const second = mergeListDirIntoCache(first, '', { ok: true, entries: [...entries] })
    expect(second).toBe(first)
  })

  it('devuelve un Map nuevo cuando aparece una entrada', () => {
    const first = mergeListDirIntoCache(new Map(), '', { ok: true, entries })
    const second = mergeListDirIntoCache(first, '', {
      ok: true,
      entries: [...entries, { name: 'lib.rs', relPath: 'lib.rs', isDirectory: false }],
    })
    expect(second).not.toBe(first)
    expect(second.get('')).toHaveLength(3)
  })

  it('devuelve un Map nuevo cuando una entrada desaparece', () => {
    const first = mergeListDirIntoCache(new Map(), '', { ok: true, entries })
    const second = mergeListDirIntoCache(first, '', { ok: true, entries: [entries[0]] })
    expect(second).not.toBe(first)
    expect(second.get('')).toHaveLength(1)
  })

  it('detecta que un nombre cambió aunque el total sea el mismo', () => {
    const first = mergeListDirIntoCache(new Map(), '', { ok: true, entries })
    const renamed = [entries[0], { name: 'lib.rs', relPath: 'lib.rs', isDirectory: false }]
    expect(mergeListDirIntoCache(first, '', { ok: true, entries: renamed })).not.toBe(first)
  })

  it('un dir que pasa a archivo cuenta como cambio', () => {
    const first = mergeListDirIntoCache(new Map(), '', { ok: true, entries })
    const flipped = [{ ...entries[0], isDirectory: false }, entries[1]]
    expect(mergeListDirIntoCache(first, '', { ok: true, entries: flipped })).not.toBe(first)
  })

  it('el prefetch de claves ya presentes no rompe la identidad', () => {
    const first = mergeListDirIntoCache(new Map(), '', {
      ok: true,
      entries,
      prefetched: { src: [{ name: 'a.rs', relPath: 'src/a.rs', isDirectory: false }] },
    })
    const second = mergeListDirIntoCache(first, '', {
      ok: true,
      entries: [...entries],
      prefetched: { src: [{ name: 'a.rs', relPath: 'src/a.rs', isDirectory: false }] },
    })
    expect(second).toBe(first)
  })
})
