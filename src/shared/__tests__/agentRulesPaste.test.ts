/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { AGENT_RULE_MAX_LENGTH, AGENT_RULES_MAX_COUNT } from '../agentIdentity'
import { applyPastedRules, splitPastedRules } from '../agentRulesPaste'

describe('splitPastedRules', () => {
  it('parte viñetas y numeración y descarta líneas vacías', () => {
    const raw = [
      '  - primera  ',
      '',
      '* segunda',
      '• tercera',
      '– cuarta',
      '1. quinta',
      '2) sexta',
      '   ',
      'sin marca',
    ].join('\n')
    expect(splitPastedRules(raw)).toEqual([
      'primera',
      'segunda',
      'tercera',
      'cuarta',
      'quinta',
      'sexta',
      'sin marca',
    ])
  })

  it('respeta CRLF y no deduplica', () => {
    expect(splitPastedRules('igual\r\nigual')).toEqual(['igual', 'igual'])
  })

  it('recorta cada línea a 280', () => {
    const long = 'x'.repeat(AGENT_RULE_MAX_LENGTH + 40)
    expect(splitPastedRules(long)).toEqual(['x'.repeat(AGENT_RULE_MAX_LENGTH)])
  })
})

describe('applyPastedRules', () => {
  it('una sola línea une before, pegado y after', () => {
    const next = applyPastedRules({
      rules: ['hello WORLD'],
      rulesEnabled: [false],
      index: 0,
      before: 'hello ',
      after: 'WORLD',
      lines: ['mid'],
    })
    expect(next.rules).toEqual(['hello midWORLD'])
    expect(next.rulesEnabled).toEqual([false])
    expect(next.dropped).toBe(0)
  })

  it('varias líneas insertan con el cursor a mitad de texto', () => {
    const next = applyPastedRules({
      rules: ['keep', 'AAA BBB', 'tail'],
      rulesEnabled: [true, false, true],
      index: 1,
      before: 'AAA ',
      after: 'BBB',
      lines: ['uno', 'dos', 'tres'],
    })
    expect(next.rules).toEqual(['keep', 'AAA uno', 'dos', 'tresBBB', 'tail'])
    expect(next.rulesEnabled).toEqual([true, false, true, true, true])
    expect(next.dropped).toBe(0)
  })

  it('recorta cada item compuesto a 280', () => {
    const before = 'b'.repeat(200)
    const line = 'c'.repeat(200)
    const next = applyPastedRules({
      rules: ['x'],
      rulesEnabled: [true],
      index: 0,
      before,
      after: '',
      lines: [line, 'ok'],
    })
    expect(next.rules[0]).toHaveLength(AGENT_RULE_MAX_LENGTH)
    expect(next.rules[0]).toBe((before + line).slice(0, AGENT_RULE_MAX_LENGTH))
    expect(next.rules[1]).toBe('ok')
  })

  it('al tope 20 suelta el excedente, no pierde reglas previas y concatena after', () => {
    const rules = Array.from({ length: 18 }, (_, i) => `pre${i}`)
    const rulesEnabled = rules.map((_, i) => i !== 10)
    const next = applyPastedRules({
      rules,
      rulesEnabled,
      index: 10,
      before: 'BEFORE ',
      after: ' AFTER',
      lines: ['a', 'b', 'c', 'd', 'e'],
    })
    const capacity = AGENT_RULES_MAX_COUNT - (rules.length - 1)
    expect(capacity).toBe(3)
    expect(next.dropped).toBe(2)
    expect(next.rules).toHaveLength(AGENT_RULES_MAX_COUNT)
    expect(next.rules.slice(0, 10)).toEqual(rules.slice(0, 10))
    expect(next.rules.slice(13)).toEqual(rules.slice(11))
    expect(next.rules[10]).toBe('BEFORE a')
    expect(next.rules[11]).toBe('b')
    expect(next.rules[12]).toBe('c AFTER')
    expect(next.rulesEnabled[10]).toBe(false)
    expect(next.rulesEnabled.slice(11, 13)).toEqual([true, true])
  })
})
