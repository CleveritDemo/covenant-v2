import { describe, expect, it } from 'vitest'
import { AGENT_IDENTITY_TEMPLATES } from '@shared/agentIdentityTemplates'
import en from '../locales/en'
import es from '../locales/es'

/** `agentPane.templateXLabel` → el valor en el locale, o undefined. */
function lookup(locale: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object'
      ? (node as Record<string, unknown>)[part]
      : undefined),
    locale,
  )
}

describe('plantillas de identidad', () => {
  const keys = AGENT_IDENTITY_TEMPLATES.flatMap(template => [
    template.labelKey,
    template.roleKey,
    template.objectiveKey,
    ...template.ruleKeys,
  ])

  it.each([['en', en], ['es', es]] as const)('%s traduce todas las claves', (_name, locale) => {
    for (const key of keys) {
      expect(typeof lookup(locale as unknown as Record<string, unknown>, key), key).toBe('string')
    }
  })

  it('no repite ids de plantilla', () => {
    const ids = AGENT_IDENTITY_TEMPLATES.map(template => template.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
