import { describe, expect, it } from 'vitest'
import {
  CLAUDE_AGENT_MODELS,
  COPILOT_AGENT_MODELS,
  CURSOR_AGENT_MODELS,
  GEMINI_AGENT_MODELS,
  GROK_AGENT_MODELS,
  MODEL_DEFAULT_SHORT,
  deriveModelShort,
  resolveModelShort,
} from '../agentCliModels'

describe('deriveModelShort', () => {
  it('arma familia + dígitos y omite cualificadores', () => {
    expect(deriveModelShort('claude-fable-5-thinking-high')).toBe('FB5')
    expect(deriveModelShort('Fable 5 Thinking')).toBe('FB5')
    expect(deriveModelShort('claude-opus-4-8-thinking-high')).toBe('O48')
    expect(deriveModelShort('composer-2.5')).toBe('C25')
    expect(deriveModelShort('gpt-5.6-sol-xhigh')).toBe('G56')
    expect(deriveModelShort('gemini-3.5-flash')).toBe('GM35')
  })

  it('añade sufijo tipográfico cuando desambigua', () => {
    expect(deriveModelShort('gpt-5.4-mini')).toBe('G54m')
    expect(deriveModelShort('claude-opus-4.6-fast')).toBe('O46f')
  })
})

describe('resolveModelShort', () => {
  it('prefiere short del catálogo', () => {
    expect(resolveModelShort('cursor', 'claude-fable-5-thinking-high')).toBe('FB5')
    expect(resolveModelShort('cursor', 'composer-2.5')).toBe('C25')
    expect(resolveModelShort('claude', 'sonnet')).toBe('S')
  })

  it('deriva cuando el id no está en catálogo', () => {
    expect(resolveModelShort('cursor', 'claude-sonnet-4.9-thinking')).toBe('S49')
  })

  it('modelo vacío usa DEF (tres letras)', () => {
    expect(MODEL_DEFAULT_SHORT).toBe('DEF')
    expect(MODEL_DEFAULT_SHORT).toHaveLength(3)
    expect(resolveModelShort('cursor', '')).toBe('DEF')
    expect(resolveModelShort('claude', '   ')).toBe('DEF')
  })
})

describe('catálogo short', () => {
  it('cada entrada conocida declara short no vacío ≤4', () => {
    const all = [
      ...CLAUDE_AGENT_MODELS,
      ...CURSOR_AGENT_MODELS,
      ...COPILOT_AGENT_MODELS,
      ...GEMINI_AGENT_MODELS,
      ...GROK_AGENT_MODELS,
    ]
    for (const option of all) {
      expect(option.short?.trim().length).toBeGreaterThan(0)
      expect(option.short!.length).toBeLessThanOrEqual(4)
    }
  })
})
