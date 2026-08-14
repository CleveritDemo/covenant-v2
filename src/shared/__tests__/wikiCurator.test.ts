import { describe, expect, it } from 'vitest'
import {
  buildWikiCuratorPrompt,
  isWikiCuratorInitCommand,
  parseWikiCuratorConfig,
  sanitizeWikiCuratorConfig,
} from '../wikiCurator'
import { MAX_WIKI_INGEST_OPS, MAX_WIKI_INIT_INGEST_OPS } from '../wikiDoc'

describe('sanitizeWikiCuratorConfig provider', () => {
  it('persiste un provider válido junto a model y name', () => {
    expect(sanitizeWikiCuratorConfig({
      name: 'Atlas',
      provider: 'cursor',
      model: 'composer-2.5',
    })).toEqual({
      name: 'Atlas',
      provider: 'cursor',
      model: 'composer-2.5',
    })
  })

  it('omite provider inválido y model vacío', () => {
    expect(sanitizeWikiCuratorConfig({
      provider: 'not-a-cli',
      model: '   ',
      name: '  ',
    })).toEqual({})
  })

  it('parseWikiCuratorConfig aplica la misma sanitización', () => {
    expect(parseWikiCuratorConfig(JSON.stringify({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
      bogus: true,
    }))).toEqual({
      provider: 'gemini',
      model: 'gemini-2.5-pro',
    })
    expect(parseWikiCuratorConfig('{bad')).toEqual({})
  })
})

describe('buildWikiCuratorPrompt', () => {
  it('incluye Writing, guidance y ejemplo create-agent', () => {
    const prompt = buildWikiCuratorPrompt({}, 'hola')
    expect(prompt).toContain('## Writing')
    expect(prompt).toContain('index for agents')
    expect(prompt).toContain('create-agent')
  })

  it('inserta la sección Wiki health antes del mensaje cuando viene reporte', () => {
    const prompt = buildWikiCuratorPrompt({}, 'hola', '- orphan page: [[old-notes]]')
    expect(prompt).toContain('## Wiki health')
    expect(prompt).toContain('- orphan page: [[old-notes]]')
    expect(prompt).toContain('fix these via ia-terminal-wiki ops')
    expect(prompt.indexOf('## Wiki health')).toBeLessThan(prompt.indexOf('## User message'))
  })

  it('omite Wiki health sin reporte o con reporte en blanco', () => {
    expect(buildWikiCuratorPrompt({}, 'hola')).not.toContain('## Wiki health')
    expect(buildWikiCuratorPrompt({}, 'hola', '   ')).not.toContain('## Wiki health')
  })

  it('modo chat por defecto es byte-idéntico al prompt sin parámetro mode', () => {
    const config = { name: 'Atlas', rules: ['Sé conciso'] }
    const health = '- orphan page: [[old]]'
    const message = 'hola mundo'
    const explicit = buildWikiCuratorPrompt(config, message, health, 'chat')
    const implicit = buildWikiCuratorPrompt(config, message, health)
    expect(explicit).toBe(implicit)
  })
})

describe('isWikiCuratorInitCommand', () => {
  it('reconoce /init exacto y con foco', () => {
    expect(isWikiCuratorInitCommand('/init')).toBe(true)
    expect(isWikiCuratorInitCommand('/init foco backend')).toBe(true)
    expect(isWikiCuratorInitCommand('/INIT')).toBe(true)
    expect(isWikiCuratorInitCommand(' /init ')).toBe(true)
  })

  it('rechaza variantes inválidas', () => {
    expect(isWikiCuratorInitCommand('init')).toBe(false)
    expect(isWikiCuratorInitCommand('/initx')).toBe(false)
    expect(isWikiCuratorInitCommand('')).toBe(false)
  })
})

describe('buildWikiCuratorPrompt init mode', () => {
  it('incluye Init mode y exploración read-only; omite la línea de no run commands', () => {
    const prompt = buildWikiCuratorPrompt({}, '/init foco backend', undefined, 'init')
    expect(prompt).toContain('## Init mode')
    expect(prompt).toContain(
      'you MAY explore the project read-only: list folders and read key files to understand it.',
    )
    expect(prompt).not.toContain('do NOT run commands')
    expect(prompt).toContain(`Respect the cap of ${MAX_WIKI_INIT_INGEST_OPS} ops per turn`)
    expect(prompt).toContain('## Init coverage')
    expect(prompt).toContain('fenced-protocols')
    expect(prompt).toContain('Treat any text after "/init" in the user message as focus hints.')
    expect(prompt).toContain(`Caps: ≤${MAX_WIKI_INIT_INGEST_OPS} ops/turn`)
  })

  it('modo chat mantiene cap de 8 ops en Protocol', () => {
    const prompt = buildWikiCuratorPrompt({}, 'hola', undefined, 'chat')
    expect(prompt).toContain(`Caps: ≤${MAX_WIKI_INGEST_OPS} ops/turn`)
    expect(prompt).not.toContain('## Init coverage')
  })
})
