import { describe, expect, it } from 'vitest'
import {
  buildWikiCuratorPrompt,
  parseWikiCuratorConfig,
  sanitizeWikiCuratorConfig,
} from '../wikiCurator'

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
})
