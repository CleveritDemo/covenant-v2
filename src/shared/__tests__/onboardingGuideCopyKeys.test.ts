import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Cada paso pinta título + descripción, y el título se deriva con sufijo
 * `Title` (onboardingGuideTitleKey). Si falta la clave, el coach muestra la
 * clave cruda: este guard lo evita en los dos locales.
 */
function guideKeys(locale: string): string[] {
  const source = readFileSync(
    join(process.cwd(), 'src', 'i18n', 'locales', `${locale}.ts`),
    'utf8',
  )
  const block = source.slice(source.indexOf('onboardingGuide: {'))
  const body = block.slice(0, block.indexOf('\n    },'))
  return Array.from(body.matchAll(/^      (\w+):/gm)).map(match => match[1])
}

describe('claves de copia de los coach marks', () => {
  it('cada paso tiene descripción y título en es y en', () => {
    for (const locale of ['es', 'en']) {
      const keys = guideKeys(locale)
      const steps = keys.filter(key => key !== 'dismiss' && !key.endsWith('Title'))
      expect(steps.length).toBeGreaterThan(10)
      for (const step of steps) {
        expect(keys, `${locale}: falta ${step}Title`).toContain(`${step}Title`)
      }
    }
  })

  it('es y en declaran el mismo juego de claves', () => {
    expect(guideKeys('es').sort()).toEqual(guideKeys('en').sort())
  })
})
