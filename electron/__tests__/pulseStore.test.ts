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

  it('acepta los cuatro kinds y sigue rechazando lo inventado', () => {
    const text = [
      '{"ts":1,"kind":"prompt"}',
      '{"ts":2,"kind":"commit"}',
      '{"ts":3,"kind":"delegate","agentId":"tl","toAgentId":"dev"}',
      '{"ts":4,"kind":"result","agentId":"dev"}',
      '{"ts":5,"kind":"rm -rf"}',
    ].join('\n')
    expect(parsePulseLines(text).map(e => e.kind)).toEqual([
      'prompt', 'commit', 'delegate', 'result',
    ])
  })

  it('tolera archivo vacío y líneas en blanco', () => {
    expect(parsePulseLines('')).toEqual([])
    expect(parsePulseLines('\n\n  \n')).toEqual([])
  })

  it('conserva las dimensiones de atribución', () => {
    const line = JSON.stringify({
      ts: 1000,
      kind: 'prompt',
      repo: 'gravity',
      branch: 'main',
      workspace: 'cleverit/ws-42',
      permissionMode: 'auto',
    })
    expect(parsePulseLines(line)[0]).toMatchObject({
      repo: 'gravity',
      branch: 'main',
      workspace: 'cleverit/ws-42',
      permissionMode: 'auto',
    })
  })

  it('los eventos viejos sin las dimensiones nuevas siguen siendo válidos', () => {
    // Lo escrito antes de añadir workspace/branch/permissionMode no se migra:
    // el agregado los trata como ausentes y sigue contando.
    const [e] = parsePulseLines('{"ts":1000,"kind":"prompt","provider":"claude"}')
    expect(e).toEqual({ ts: 1000, kind: 'prompt', provider: 'claude' })
  })
})
