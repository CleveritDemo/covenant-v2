import { describe, expect, it } from 'vitest'
import {
  filterSettingsEntries,
  normalizeSearchText,
  type SettingsSearchEntry,
} from '../settingsSearch'

const ENTRIES: SettingsSearchEntry[] = [
  {
    category: 'appearance',
    anchor: 'settings-typography',
    title: 'Tipografía',
    categoryLabel: 'Apariencia',
    terms: ['Fuente de la interfaz', 'Fuente de la terminal'],
  },
  {
    category: 'appearance',
    anchor: 'settings-language',
    title: 'Idioma',
    categoryLabel: 'Apariencia',
  },
  {
    category: 'advanced',
    anchor: 'settings-discord',
    title: 'Discord',
    categoryLabel: 'Avanzado',
    terms: ['Rich Presence'],
  },
]

describe('normalizeSearchText', () => {
  it('quita acentos y baja a minúsculas', () => {
    expect(normalizeSearchText('  TipografÍA  ')).toBe('tipografia')
  })
})

describe('filterSettingsEntries', () => {
  it('una consulta vacía no devuelve nada (la lista normal sigue visible)', () => {
    expect(filterSettingsEntries(ENTRIES, '')).toEqual([])
    expect(filterSettingsEntries(ENTRIES, '   ')).toEqual([])
  })

  it('encuentra por título sin importar el acento', () => {
    expect(filterSettingsEntries(ENTRIES, 'tipografia')).toHaveLength(1)
    expect(filterSettingsEntries(ENTRIES, 'TIPOGRAFÍA')[0]?.anchor).toBe('settings-typography')
  })

  it('encuentra por una etiqueta que no se muestra', () => {
    const [found] = filterSettingsEntries(ENTRIES, 'fuente')
    expect(found?.title).toBe('Tipografía')
  })

  it('encuentra por el nombre de la categoría', () => {
    expect(filterSettingsEntries(ENTRIES, 'avanzado')).toHaveLength(1)
  })

  it('exige todas las palabras, no cualquiera', () => {
    expect(filterSettingsEntries(ENTRIES, 'fuente terminal')).toHaveLength(1)
    // «idioma» está en otra entrada: juntas no deben devolver ninguna.
    expect(filterSettingsEntries(ENTRIES, 'fuente idioma')).toHaveLength(0)
  })

  it('sin resultados devuelve una lista vacía, no todo el índice', () => {
    expect(filterSettingsEntries(ENTRIES, 'bluetooth')).toEqual([])
  })
})
