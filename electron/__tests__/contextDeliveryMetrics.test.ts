import { describe, expect, it, beforeEach } from 'vitest'
import {
  claudeTurnUsage,
  clearContextDeliveryMetrics,
  getContextDeliveryMetrics,
  normalizeClaudeEvent,
} from '../agentCliRuntime'

describe('métricas de entrega de contexto', () => {
  beforeEach(() => clearContextDeliveryMetrics())

  it('clear deja los contadores en cero', () => {
    clearContextDeliveryMetrics()
    expect(getContextDeliveryMetrics()).toMatchObject({
      catalogChars: 0,
      sectionsRequested: 0,
      sectionsDelivered: 0,
      sectionsPreattached: 0,
      inputTokens: 0,
      outputTokens: 0,
    })
  })
})

/** Forma real, copiada de un evento `result` de `claude --output-format stream-json`. */
const resultEvent = {
  type: 'result',
  result: 'ok',
  session_id: 's-1',
  usage: {
    input_tokens: 2,
    cache_creation_input_tokens: 22476,
    cache_read_input_tokens: 100,
    output_tokens: 4,
  },
}

describe('claudeTurnUsage', () => {
  it('suma los campos de caché al input: ahí está el preámbulo', () => {
    // Sin sumarlos, un agente con plugins mide igual que uno sin ellos y la
    // comparación antes/después no sirve para nada.
    expect(claudeTurnUsage(resultEvent)).toEqual({ inputTokens: 22578, outputTokens: 4 })
  })

  it('un evento sin usage no rompe ni ensucia los contadores', () => {
    expect(claudeTurnUsage({ type: 'result' })).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(claudeTurnUsage({ type: 'result', usage: { input_tokens: 'muchos' } }))
      .toEqual({ inputTokens: 0, outputTokens: 0 })
  })

  it('normalizar el evento final emite usage con los tres campos de caché sumados', () => {
    expect(normalizeClaudeEvent(resultEvent)).toEqual([
      { type: 'session', cliSessionId: 's-1' },
      { type: 'usage', inputTokens: 22578, outputTokens: 4 },
      { type: 'assistant_final', text: 'ok' },
    ])
  })
})
