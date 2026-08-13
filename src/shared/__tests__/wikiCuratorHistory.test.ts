import { describe, expect, it } from 'vitest'
import {
  MAX_WIKI_CURATOR_HISTORY,
  appendWikiCuratorHistoryEntry,
  parseWikiCuratorHistory,
  wikiCuratorHistoryStorageKey,
  type WikiCuratorHistoryEntry,
} from '../wikiCuratorHistory'

const sample = (role: WikiCuratorHistoryEntry['role'], text: string, at: number): WikiCuratorHistoryEntry => (
  { role, text, at }
)

describe('appendWikiCuratorHistoryEntry', () => {
  it('agrega al final', () => {
    const base = [sample('user', 'hola', 1)]
    expect(appendWikiCuratorHistoryEntry(base, sample('curator', 'resp', 2))).toEqual([
      sample('user', 'hola', 1),
      sample('curator', 'resp', 2),
    ])
  })

  it('recorta a las últimas 80 entradas', () => {
    const full = Array.from({ length: MAX_WIKI_CURATOR_HISTORY }, (_, i) => (
      sample('user', `m${i}`, i)
    ))
    const next = appendWikiCuratorHistoryEntry(full, sample('curator', 'nuevo', 999))
    expect(next).toHaveLength(MAX_WIKI_CURATOR_HISTORY)
    expect(next[0].text).toBe('m1')
    expect(next[next.length - 1]).toEqual(sample('curator', 'nuevo', 999))
  })
})

describe('parseWikiCuratorHistory', () => {
  it('devuelve [] ante JSON inválido', () => {
    expect(parseWikiCuratorHistory('')).toEqual([])
    expect(parseWikiCuratorHistory('{')).toEqual([])
    expect(parseWikiCuratorHistory('"texto"')).toEqual([])
  })

  it('filtra entradas parcialmente inválidas', () => {
    const json = JSON.stringify([
      { role: 'user', text: 'ok', at: 1 },
      { role: 'nope', text: 'x', at: 2 },
      { role: 'curator', text: 'sin-at' },
      { role: 'error', text: 'falló', at: 3 },
    ])
    expect(parseWikiCuratorHistory(json)).toEqual([
      sample('user', 'ok', 1),
      sample('error', 'falló', 3),
    ])
  })

  it('devuelve [] si no es un array', () => {
    expect(parseWikiCuratorHistory('{}')).toEqual([])
  })
})

describe('wikiCuratorHistoryStorageKey', () => {
  it('incluye el cwd en la clave', () => {
    expect(wikiCuratorHistoryStorageKey('/tmp/proyecto')).toBe('wiki-curator-history:/tmp/proyecto')
  })
})
