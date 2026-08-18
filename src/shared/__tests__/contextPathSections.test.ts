import { describe, expect, it } from 'vitest'
import { contextPreambleText, splitPathSections } from '../contextReportDoc'

describe('splitPathSections', () => {
  it('parte tres secciones con fences', () => {
    const auto = [
      'Preamble descartado',
      '### src/a.ts',
      '```ts',
      'const a = 1',
      '```',
      '### src/b.ts',
      '```ts',
      'const b = 2',
      '```',
      '### lib/c.ts',
      '```ts',
      'const c = 3',
      '```',
    ].join('\n')

    expect(splitPathSections(auto)).toEqual([
      { path: 'src/a.ts', body: '```ts\nconst a = 1\n```' },
      { path: 'src/b.ts', body: '```ts\nconst b = 2\n```' },
      { path: 'lib/c.ts', body: '```ts\nconst c = 3\n```' },
    ])
    expect(contextPreambleText(auto)).toBe('Preamble descartado')
  })

  it('acepta una sección con texto sin fence', () => {
    const auto = '### README.md\nNotas del archivo.'
    expect(splitPathSections(auto)).toEqual([
      { path: 'README.md', body: 'Notas del archivo.' },
    ])
  })

  it('sin ### devuelve vacío', () => {
    expect(splitPathSections('solo texto\nsin encabezados')).toEqual([])
    expect(contextPreambleText('solo texto\nsin encabezados')).toBe('')
  })

  it('ignora ### dentro de un fence markdown', () => {
    const auto = [
      '### src/a.ts',
      '```md',
      '### esto no es sección',
      'hola',
      '```',
      '### src/b.ts',
      'ok',
    ].join('\n')

    expect(splitPathSections(auto)).toEqual([
      { path: 'src/a.ts', body: '```md\n### esto no es sección\nhola\n```' },
      { path: 'src/b.ts', body: 'ok' },
    ])
  })

  it('descarta secciones con body vacío', () => {
    expect(splitPathSections('### a.ts\n### b.ts\nhola')).toEqual([
      { path: 'b.ts', body: 'hola' },
    ])
  })
})
