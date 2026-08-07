import { describe, expect, it } from 'vitest'
import { deliveryModeFor, summarizeContextBudget } from '../contextBudget'
import { MAX_REQUESTED_CONTEXT_CHARS } from '../contextSections'
import { HOST_CONTEXT_KINDS } from '../tabContext'

/** Sección sintética del tamaño pedido; solo importa `chars`. */
const section = (chars: number) => ({ key: `k${chars}`, label: 'l', chars })

describe('deliveryModeFor', () => {
  it('notes y agentResult se adjuntan enteros', () => {
    expect(deliveryModeFor('notes')).toBe('whole')
    expect(deliveryModeFor('agentResult')).toBe('whole')
  })

  it('todos los kinds host viajan como catálogo', () => {
    for (const kind of HOST_CONTEXT_KINDS) {
      expect(deliveryModeFor(kind)).toBe('catalog')
    }
  })
})

describe('summarizeContextBudget', () => {
  it('cuenta secciones y suma caracteres', () => {
    const summary = summarizeContextBudget([section(100), section(250)], 'readme')
    expect(summary.sections).toBe(2)
    expect(summary.chars).toBe(350)
  })

  it('estima tokens como chars/4 redondeado hacia arriba', () => {
    expect(summarizeContextBudget([section(401)], 'readme').estimatedTokens).toBe(101)
  })

  it('una lista vacía es un presupuesto en cero, no un NaN', () => {
    const summary = summarizeContextBudget([], 'readme')
    expect(summary).toMatchObject({ sections: 0, chars: 0, estimatedTokens: 0, ratio: 0, level: 'ok' })
  })

  // Fronteras exactas: 55 % y 85 % de MAX_REQUESTED_CONTEXT_CHARS (60.000).
  it.each([
    [Math.floor(MAX_REQUESTED_CONTEXT_CHARS * 0.54), 'ok'],
    [Math.ceil(MAX_REQUESTED_CONTEXT_CHARS * 0.55), 'warn'],
    [Math.floor(MAX_REQUESTED_CONTEXT_CHARS * 0.84), 'warn'],
    [Math.ceil(MAX_REQUESTED_CONTEXT_CHARS * 0.85), 'over'],
  ])('%i caracteres → nivel %s', (chars, level) => {
    expect(summarizeContextBudget([section(chars)], 'readme').level).toBe(level)
  })

  it('satura ratio en 1 cuando se pasa del presupuesto', () => {
    const summary = summarizeContextBudget([section(MAX_REQUESTED_CONTEXT_CHARS * 3)], 'readme')
    expect(summary.ratio).toBe(1)
    expect(summary.level).toBe('over')
  })

  it('arrastra el modo de entrega del kind', () => {
    expect(summarizeContextBudget([section(10)], 'notes').delivery).toBe('whole')
    expect(summarizeContextBudget([section(10)], 'symbols').delivery).toBe('catalog')
  })
})
