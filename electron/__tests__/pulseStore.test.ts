import { describe, expect, it, vi } from 'vitest'

// pulseStore importa `app` de electron solo para resolver userData; el parseo
// que interesa acá es puro, así que basta con que el módulo cargue.
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))

const { parsePulseLines } = await import('../pulseStore')

describe('parsePulseLines', () => {
  it('lee eventos válidos', () => {
    const text = [
      '{"ts":1000,"kind":"prompt","provider":"claude","tokensIn":10,"tokensOut":2}',
      '{"ts":2000,"kind":"commit","repo":"gravity"}',
    ].join('\n')
    expect(parsePulseLines(text)).toEqual([
      { ts: 1000, kind: 'prompt', provider: 'claude', tokensIn: 10, tokensOut: 2 },
      { ts: 2000, kind: 'commit', repo: 'gravity' },
    ])
  })

  it('descarta una última línea truncada sin perder las anteriores', () => {
    const text = '{"ts":1000,"kind":"prompt"}\n{"ts":2000,"kin'
    expect(parsePulseLines(text)).toEqual([{ ts: 1000, kind: 'prompt' }])
  })

  it('descarta filas sin ts o con kind desconocido', () => {
    const text = [
      '{"kind":"prompt"}',
      '{"ts":"ayer","kind":"prompt"}',
      '{"ts":1,"kind":"borrar_todo"}',
      '{"ts":3000,"kind":"prompt"}',
    ].join('\n')
    expect(parsePulseLines(text)).toEqual([{ ts: 3000, kind: 'prompt' }])
  })

  it('tolera archivo vacío y líneas en blanco', () => {
    expect(parsePulseLines('')).toEqual([])
    expect(parsePulseLines('\n\n  \n')).toEqual([])
  })
})
