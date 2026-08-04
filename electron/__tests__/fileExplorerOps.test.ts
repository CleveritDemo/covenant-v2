import { afterAll, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  createDirForExplorer,
  createFileForExplorer,
  listDirChildren,
  LIST_DIR_PREFETCH_CAP,
} from '../fileExplorerOps'

describe('fileExplorerOps', () => {
  const root = mkdtempSync(join(tmpdir(), 'fe-test-'))

  it('lists directory children asynchronously', async () => {
    mkdirSync(join(root, 'src'), { recursive: true })
    writeFileSync(join(root, 'readme.md'), '')
    const result = await listDirChildren(root, '', true, { prefetchDepth: 0 })
    expect(result.ok).toBe(true)
    expect(result.entries.some(e => e.name === 'src' && e.isDirectory)).toBe(true)
    expect(result.entries.some(e => e.name === 'readme.md')).toBe(true)
    expect(result.prefetched).toBeUndefined()
  })

  it('hides heavy dirs when showHiddenDirs is false', async () => {
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    const hidden = await listDirChildren(root, '', false, { prefetchDepth: 0 })
    expect(hidden.entries.every(e => e.name !== 'node_modules')).toBe(true)
    const shown = await listDirChildren(root, '', true, { prefetchDepth: 0 })
    expect(shown.entries.some(e => e.name === 'node_modules')).toBe(true)
  })

  it('prefetches child directory listings (depth 1)', async () => {
    mkdirSync(join(root, 'app', 'components'), { recursive: true })
    writeFileSync(join(root, 'app', 'index.ts'), '')
    writeFileSync(join(root, 'app', 'components', 'Button.tsx'), '')
    const result = await listDirChildren(root, '', true, { prefetchDepth: 1 })
    expect(result.ok).toBe(true)
    expect(result.prefetched?.app?.some(e => e.name === 'components' && e.isDirectory)).toBe(true)
    expect(result.prefetched?.app?.some(e => e.name === 'index.ts')).toBe(true)
    expect(result.prefetched?.['app/components']).toBeUndefined()
  })

  it('respects prefetchCap', async () => {
    const capRoot = join(root, 'cap-root')
    mkdirSync(capRoot, { recursive: true })
    for (let i = 0; i < 5; i += 1) {
      mkdirSync(join(capRoot, `d-${i}`), { recursive: true })
      writeFileSync(join(capRoot, `d-${i}`, 'f.txt'), '')
    }
    const result = await listDirChildren(root, 'cap-root', true, {
      prefetchDepth: 1,
      prefetchCap: 2,
    })
    expect(result.ok).toBe(true)
    expect(Object.keys(result.prefetched ?? {}).length).toBe(2)
    expect(LIST_DIR_PREFETCH_CAP).toBeGreaterThan(0)
  })

  it('rejects duplicate directory creation', () => {
    const dir = join(root, 'dup-dir')
    mkdirSync(dir)
    const result = createDirForExplorer(root, 'dup-dir')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('DIR_EXISTS')
  })

  it('rejects duplicate file creation', () => {
    writeFileSync(join(root, 'exists.txt'), '')
    const result = createFileForExplorer(root, 'exists.txt')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('FILE_EXISTS')
  })

  it('creates a new file under an existing directory', () => {
    mkdirSync(join(root, 'landing'), { recursive: true })
    const result = createFileForExplorer(root, 'landing/hola.ts')
    expect(result.ok).toBe(true)
    expect(existsSync(join(root, 'landing', 'hola.ts'))).toBe(true)
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })
})
