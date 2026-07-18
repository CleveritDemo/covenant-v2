import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it, afterEach } from 'vitest'
import { searchProjectFiles } from '../fileExplorerOps'

describe('searchProjectFiles', () => {
  let dir = ''

  afterEach(() => {
    if (dir) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
      dir = ''
    }
  })

  it('finds files by name via fallback walk', () => {
    dir = join(tmpdir(), `fe-search-${Date.now()}`)
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'helloWorld.ts'), 'export {}')
    writeFileSync(join(dir, 'readme.md'), '# hi')

    const result = searchProjectFiles(dir, 'helloworld')
    expect(result.ok).toBe(true)
    expect(result.paths).toContain('src/helloWorld.ts')
    expect(result.hits?.some(h => h.relPath === 'src/helloWorld.ts' && !h.isDirectory)).toBe(true)
  })

  it('types matching directories as directories', () => {
    dir = join(tmpdir(), `fe-search-dir-${Date.now()}`)
    mkdirSync(join(dir, 'uniqueDirName'), { recursive: true })
    writeFileSync(join(dir, 'uniqueDirName', 'a.ts'), 'export {}')

    const result = searchProjectFiles(dir, 'uniquedirname')
    expect(result.ok).toBe(true)
    const hit = result.hits?.find(h => h.relPath === 'uniqueDirName')
    expect(hit?.isDirectory).toBe(true)
  })

  it('returns empty for blank query', () => {
    dir = join(tmpdir(), `fe-search-blank-${Date.now()}`)
    mkdirSync(dir)
    const result = searchProjectFiles(dir, '   ')
    expect(result.ok).toBe(true)
    expect(result.paths).toEqual([])
    expect(result.hits).toEqual([])
  })
})
