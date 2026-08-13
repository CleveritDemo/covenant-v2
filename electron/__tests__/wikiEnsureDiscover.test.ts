import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureWikiWithSeed } from '../wikiStore'
import { discoverTabContexts } from '../tabContextBuild'

describe('ensure wiki then discover', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('tras ensureWikiWithSeed el discover lista el contexto kind wiki', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-wiki-ensure-disc-'))
    dirs.push(cwd)

    // Sin wiki en disco no hay contexto wiki.
    const before = discoverTabContexts(cwd)
    expect(before.ok).toBe(true)
    expect(before.contexts.some(context => context.kind === 'wiki')).toBe(false)

    const result = ensureWikiWithSeed(cwd)
    expect(result.ok).toBe(true)

    const after = discoverTabContexts(cwd)
    expect(after.ok).toBe(true)
    const wiki = after.contexts.find(context => context.kind === 'wiki')
    expect(wiki).toMatchObject({ id: 'iaterminal:wiki', name: 'Wiki', fileName: 'wiki.md' })
  })
})
