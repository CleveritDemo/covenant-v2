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

  // Los chips se distinguen sólo por su etiqueta: dos iguales serían dos
  // botones indistinguibles que rellenan cosas distintas.
  it.each([['en', en], ['es', es]] as const)('%s no repite etiquetas', (_name, locale) => {
    const labels = AGENT_IDENTITY_TEMPLATES.map(
      template => lookup(locale as unknown as Record<string, unknown>, template.labelKey),
    )
    expect(new Set(labels).size).toBe(labels.length)
  })
})
