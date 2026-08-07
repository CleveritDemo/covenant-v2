import { describe, it, expect } from 'vitest'
import {
  agentMonogram,
  paletteColorForSeed,
  TAB_CONTEXT_COLORS,
} from '../tabContextAppearance'

describe('agentMonogram', () => {
  it('toma la inicial de las dos primeras palabras', () => {
    expect(agentMonogram('Product Owner')).toBe('PO')
    expect(agentMonogram('Tech Lead Senior')).toBe('TL')
  })

  it('usa dos letras cuando hay una sola palabra', () => {
    expect(agentMonogram('Backend')).toBe('BA')
    expect(agentMonogram('qa')).toBe('QA')
  })

  it('ignora separadores y acepta acentos', () => {
    expect(agentMonogram('product-owner')).toBe('PO')
    expect(agentMonogram('Diseño')).toBe('DI')
  })

  it('cae a ? sin nombre util', () => {
    expect(agentMonogram('   ')).toBe('?')
  })
})

describe('paletteColorForSeed', () => {
  it('es estable y siempre de la paleta', () => {
    const color = paletteColorForSeed('iaterminal:result:tl')
    expect(color).toBe(paletteColorForSeed('iaterminal:result:tl'))
    expect(TAB_CONTEXT_COLORS).toContain(color)
  })

  it('reparte semillas distintas', () => {
    const colors = ['backend', 'frontend', 'product-owner', 'qa', 'tl']
      .map(slug => paletteColorForSeed(`iaterminal:result:${slug}`))
    expect(new Set(colors).size).toBeGreaterThan(1)
  })
})
