import { describe, it, expect } from 'vitest'
import { fontStack, UI_FONTS, MONO_FONTS } from '../fontStacks'

describe('fontStack', () => {
  it('devuelve null sin elección: se usa el stack de global.css', () => {
    expect(fontStack('', 'ui')).toBeNull()
    expect(fontStack('   ', 'mono')).toBeNull()
  })

  it('antepone la familia elegida a los fallbacks', () => {
    expect(fontStack('Menlo', 'mono')).toMatch(/^'Menlo', /)
    expect(fontStack('Optima', 'ui')).toMatch(/^'Optima', /)
  })

  it('cierra el stack de UI en sans-serif y el mono en monospace', () => {
    expect(fontStack('Optima', 'ui')?.endsWith('sans-serif')).toBe(true)
    expect(fontStack('Menlo', 'mono')?.endsWith('monospace')).toBe(true)
  })

  it('rechaza nombres que podrían inyectar CSS al escribirse en style', () => {
    expect(fontStack("Menlo', red; --x: '", 'mono')).toBeNull()
    expect(fontStack('Menlo, monospace', 'mono')).toBeNull()
  })

  it('todas las familias de los catálogos producen un stack', () => {
    for (const f of [...UI_FONTS, ...MONO_FONTS]) {
      expect(fontStack(f, 'ui')).not.toBeNull()
    }
  })
})
