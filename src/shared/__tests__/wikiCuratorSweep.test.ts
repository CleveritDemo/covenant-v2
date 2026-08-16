import { describe, expect, it } from 'vitest'
import {
  MAX_WIKI_SWEEP_INGEST_OPS,
  WIKI_SWEEP_PASSES,
  buildWikiSweepPassPrompt,
} from '../wikiCuratorSweep'
import { MAX_WIKI_INIT_INGEST_OPS } from '../wikiDoc'

describe('wikiCuratorSweep shared', () => {
  it('expone cap de ingest y orden fijo de pases', () => {
    expect(MAX_WIKI_SWEEP_INGEST_OPS).toBe(24)
    expect(WIKI_SWEEP_PASSES).toEqual(['health', 'truth', 'coverage', 'shape', 'closing'])
  })

  it('buildWikiSweepPassPrompt antepone Sweep pass y usa modo init', () => {
    const prompt = buildWikiSweepPassPrompt('truth', {}, '- orphan page: [[old]]', 2, 5)
    expect(prompt.startsWith('## Sweep pass\nPass 2/5: truth\n')).toBe(true)
    expect(prompt).toContain('## Init mode')
    expect(prompt).toContain('## Wiki health')
    expect(prompt).toContain('- orphan page: [[old]]')
    expect(prompt).toContain(
      'Read the real code behind the claims made by existing pages and correct every stale or false statement.',
    )
    expect(prompt).toContain(`Caps: ≤${MAX_WIKI_INIT_INGEST_OPS} ops/turn`)
  })

  it('cada pase lleva su objetivo exacto', () => {
    const health = buildWikiSweepPassPrompt('health', {}, undefined, 1, 5)
    expect(health).toContain('Do NOT create new subject pages in this pass.')

    const coverage = buildWikiSweepPassPrompt('coverage', {}, undefined, 3, 5)
    expect(coverage).toContain('following the Init coverage catalog')

    const closing = buildWikiSweepPassPrompt('closing', {}, undefined, 5, 5)
    expect(closing).toContain('Create no new pages.')
  })
})
