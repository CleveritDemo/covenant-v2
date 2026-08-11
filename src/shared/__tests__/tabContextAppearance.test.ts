import { describe, it, expect } from 'vitest'
import {
  agentMonogram,
  filterContextIconGroups,
  normalizeContextIcon,
  paletteColorForSeed,
  TAB_CONTEXT_COLORS,
  TAB_CONTEXT_ICON_NAMES,
} from '../tabContextAppearance'

describe('filterContextIconGroups', () => {
  it('sin consulta devuelve todos los iconos', () => {
    const icons = filterContextIconGroups('').flatMap(group => group.icons)
    expect(icons).toEqual([...TAB_CONTEXT_ICON_NAMES])
  })

  it('busca por nombre, por sinonimo y sin tildes', () => {
    const find = (query: string): string[] =>
      filterContextIconGroups(query).flatMap(group => group.icons)
    expect(find('data')).toContain('database')
    expect(find('rama')).toContain('git-branch')
    expect(find('GRÁFICO')).toContain('chart')
  })

  it('descarta grupos vacios y no inventa resultados', () => {
    expect(filterContextIconGroups('zzzz')).toEqual([])
    expect(filterContextIconGroups('sql').every(group => group.icons.length > 0)).toBe(true)
  })

  it('los iconos ya guardados siguen siendo validos', () => {
    // El set solo puede crecer: quitar uno dejaría contextos existentes sin cara.
    for (const icon of ['folder', 'files', 'code', 'note', 'git-branch', 'package', 'book', 'history', 'sparkles', 'bot', 'brain', 'search', 'terminal', 'settings', 'jira', 'atlassian', 'port', 'mcp', 'table']) {
      expect(normalizeContextIcon(icon)).toBe(icon)
    }
  })
})

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
