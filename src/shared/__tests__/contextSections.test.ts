import { describe, expect, it } from 'vitest'
import { sectionsForContext, AUTO_START, AUTO_END } from '../contextSections'
import type { TabContext } from '../tabContext'

const kindOnly = (kind: TabContext['kind']): Pick<TabContext, 'kind'> => ({ kind })

/** Envuelve un cuerpo en el bloque auto, como lo escribe composeDocument(). */
const auto = (body: string): string => [AUTO_START, body, AUTO_END].join('\n')

const ok = (content: string) => ({ ok: true as const, content })

describe('sectionsForContext', () => {
  it('parte markdown por encabezados ## y ###, ignorando los de dentro de un fence', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto([
      '## Instalación',
      'npm install',
      '```md',
      '## Esto no es un encabezado',
      '```',
      '## Comandos',
      'npm test',
    ].join('\n'))))

    expect(sections.map(s => s.key)).toEqual(['Instalación', 'Comandos'])
    expect(sections[0].content).toContain('## Esto no es un encabezado')
  })

  it('descarta el contenido anterior al primer encabezado', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto([
      'Este preámbulo se pierde.',
      '## Solo esto',
      'cuerpo',
    ].join('\n'))))

    expect(sections).toHaveLength(1)
    expect(sections[0].content).not.toContain('preámbulo')
  })

  it('sin encabezados devuelve una única sección "all"', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto('texto suelto')))
    expect(sections.map(s => s.key)).toEqual(['all'])
  })

  it('folderTree parte por líneas sin sangría', () => {
    const sections = sectionsForContext(kindOnly('folderTree'), ok(auto([
      'electron/  (main y preload)',
      '  main.ts',
      'src/',
      '  renderer/',
    ].join('\n'))))

    expect(sections.map(s => s.key)).toEqual(['electron', 'src'])
    expect(sections[0].label).toBe('electron/  (main y preload)')
  })

  it('deps parte por clave de nivel superior del JSON', () => {
    const sections = sectionsForContext(kindOnly('deps'), ok(auto(
      JSON.stringify({ dependencies: { react: '18' }, scripts: { test: 'vitest' } }),
    )))
    expect(sections.map(s => s.key)).toEqual(['dependencies', 'scripts'])
  })

  it('git separa status de diff stat', () => {
    const sections = sectionsForContext(kindOnly('git'), ok(auto(
      'On branch main\n\nDiff stat:\n 1 file changed',
    )))
    expect(sections.map(s => s.key)).toEqual(['status', 'diff-stat'])
  })

  it('añade la sección de notas cuando el documento las trae', () => {
    const doc = [
      AUTO_START,
      '## Uno',
      'cuerpo',
      AUTO_END,
      '<!-- iaterminal:notes -->',
      '- `src/App.tsx` — punto de entrada',
      '<!-- /iaterminal:notes -->',
    ].join('\n')

    const sections = sectionsForContext(kindOnly('readme'), ok(doc))
    expect(sections.map(s => s.key)).toEqual(['Uno', '__notes'])
  })

  it('notes usa notesContent y no lleva sección de notas', () => {
    const sections = sectionsForContext(
      kindOnly('notes'),
      { ok: true, content: 'ignorado', notesContent: '## Reglas\ncuerpo' },
    )
    expect(sections.map(s => s.key)).toEqual(['Reglas'])
  })

  it('un materializado con error produce una sección "error"', () => {
    const sections = sectionsForContext(
      kindOnly('readme'),
      { ok: false, content: '', error: 'no existe' },
    )
    expect(sections.map(s => s.key)).toEqual(['error'])
    expect(sections[0].content).toContain('no existe')
  })

  it('cada sección reporta chars igual a la longitud de su contenido', () => {
    const sections = sectionsForContext(kindOnly('readme'), ok(auto('## Uno\ncuerpo')))
    expect(sections[0].chars).toBe(sections[0].content.length)
  })

  describe('wiki', () => {
    it('parte solo en ## Index, ### <slug> y ## Log', () => {
      const sections = sectionsForContext(kindOnly('wiki'), ok(auto([
        '## Index',
        '# Wiki index',
        '- [[auth]] — Auth (concept)',
        '### auth',
        'Cuerpo de auth.',
        '### pagos.v2',
        'Cuerpo de pagos.',
        '## Log',
        '- `2026-08-13T00:00:00.000Z` — seeded',
      ].join('\n'))))

      expect(sections.map(s => s.key)).toEqual(['index', 'auth', 'pagos.v2', 'log'])
      expect(sections[0].content).toContain('- [[auth]]')
      expect(sections[3].content).toContain('seeded')
    })

    it('headings internos (más profundos, con espacios o mayúsculas) no fragmentan', () => {
      const sections = sectionsForContext(kindOnly('wiki'), ok(auto([
        '## Index',
        '(empty index)',
        '### auth',
        '#### Detalle profundo',
        '### Con Espacios no corta',
        '### MAYUS',
        '## Notas internas',
        'siguen dentro de auth',
        '## Log',
        '(empty log)',
      ].join('\n'))))

      expect(sections.map(s => s.key)).toEqual(['index', 'auth', 'log'])
      expect(sections[1].content).toContain('#### Detalle profundo')
      expect(sections[1].content).toContain('### Con Espacios no corta')
      expect(sections[1].content).toContain('### MAYUS')
      expect(sections[1].content).toContain('## Notas internas')
    })

    it('los límites dentro de un fence son contenido, no cortes', () => {
      const sections = sectionsForContext(kindOnly('wiki'), ok(auto([
        '## Index',
        '(empty index)',
        '### auth',
        '```md',
        '## Log',
        '### otro-slug',
        '```',
        'sigue auth',
        '## Log',
        '- entrada real',
      ].join('\n'))))

      expect(sections.map(s => s.key)).toEqual(['index', 'auth', 'log'])
      expect(sections[1].content).toContain('### otro-slug')
      expect(sections[2].content).toContain('- entrada real')
    })
  })
})
