import { describe, expect, it } from 'vitest'
import en from '../locales/en'
import es from '../locales/es'

/**
 * Paridad en/es de las claves del CTA 'Crear wiki' del mapa. El `satisfies
 * AppTranslations` de es.ts ya obliga la estructura en compile time; esto
 * cubre el runtime (valores no vacíos y distintos entre locales).
 */
const KEYS = ['wikiMapCreate', 'wikiMapCreating', 'wikiMapCreateError'] as const

describe('claves wikiMapCreate*', () => {
  it.each([['en', en], ['es', es]] as const)('%s las traduce todas', (_name, locale) => {
    for (const key of KEYS) {
      const value = (locale.tabs as Record<string, unknown>)[key]
      expect(typeof value, key).toBe('string')
      expect((value as string).trim().length, key).toBeGreaterThan(0)
    }
  })

  it('en y es no comparten el mismo copy', () => {
    for (const key of KEYS) {
      expect(en.tabs[key]).not.toBe((es.tabs as Record<string, string>)[key])
    }
  })
})
