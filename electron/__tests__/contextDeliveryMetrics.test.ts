import { describe, expect, it, beforeEach } from 'vitest'
import {
  claudeTurnUsage,
  clearContextDeliveryMetrics,
  getContextDeliveryMetrics,
  normalizeClaudeEvent,
  recordTurnUsage,
} from '../agentCliRuntime'

describe('métricas de entrega de contexto', () => {
  beforeEach(() => clearContextDeliveryMetrics())

  it('acumula tokens de varios turnos', () => {
    recordTurnUsage({ inputTokens: 1200, outputTokens: 300 })
    recordTurnUsage({ inputTokens: 800, outputTokens: 150 })
    expect(getContextDeliveryMetrics()).toMatchObject({ inputTokens: 2000, outputTokens: 450 })
  })

  it('ignora valores que no son números finitos', () => {
    recordTurnUsage({ inputTokens: Number.NaN, outputTokens: 10 })
    expect(getContextDeliveryMetrics()).toMatchObject({ inputTokens: 0, outputTokens: 10 })
  })

  it('clear deja los contadores en cero', () => {
    recordTurnUsage({ inputTokens: 5, outputTokens: 5 })
    clearContextDeliveryMetrics()
    expect(getContextDeliveryMetrics()).toMatchObject({ inputTokens: 0, outputTokens: 0 })
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
  beforeEach(() => clearContextDeliveryMetrics())

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

  it('normalizar el evento final acumula el uso del turno', () => {
    normalizeClaudeEvent(resultEvent)
    expect(getContextDeliveryMetrics()).toMatchObject({ inputTokens: 22578, outputTokens: 4 })
  })
})
