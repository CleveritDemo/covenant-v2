import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { ensureAiAgentResults } from '../aiAgentResults'
import { upsertProjectAgent } from '../projectAgentCatalogOps'
import { discoverTabContexts } from '../tabContextBuild'

describe('ensure then discover agentResult', () => {
  const dirs: string[] = []
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  })

  it('lists newly created results in discover', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'ia-ensure-disc-'))
    dirs.push(cwd)
    upsertProjectAgent(cwd, {
      id: 'fullstack',
      provider: 'cursor',
      permissionMode: 'auto',
      name: 'Fullstack',
      emitResults: true,
    })
    const path = ensureAiAgentResults(cwd, 'fullstack', 'Fullstack')
    expect(existsSync(path)).toBe(true)
    const discovered = discoverTabContexts(cwd)
    expect(discovered.ok).toBe(true)
    const results = discovered.contexts.filter(context => context.kind === 'agentResult')
    expect(results.some(context => context.id === 'iaterminal:result:fullstack')).toBe(true)
  })
})
