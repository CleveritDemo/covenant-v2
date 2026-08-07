import { describe, expect, it } from 'vitest'
import { parseContextDoc, splitFences } from '../contextReportDoc'

/** Documento tal como lo escribe composeDocument() en electron/tabContextBuild.ts. */
const doc = [
  '# folders',
  '<!-- iaterminal:context {"version":1,"id":"iaterminal:folderTree:folders","kind":"folderTree"} -->',
  '',
  '<!-- iaterminal:auto -->',
  'gravity/  (project root; paths are relative to this folder)',
  '',
  'src/',
  '  src/shared/',
  '<!-- /iaterminal:auto -->',
  '',
  '<!-- iaterminal:notes -->',
  'El árbol ignora target/ y node_modules.',
  '',
  '- `src/shared/` — lógica pura compartida',
  '- `src/renderer/` — sin acceso a Node',
  '<!-- /iaterminal:notes -->',
  '',
].join('\n')

describe('parseContextDoc', () => {
  it('separa auto, notas humanas y anotaciones', () => {
    const parsed = parseContextDoc(doc)
    expect(parsed.auto.startsWith('gravity/')).toBe(true)
    expect(parsed.auto).toContain('  src/shared/')
    expect(parsed.notes).toBe('El árbol ignora target/ y node_modules.')
    expect(parsed.annotations).toEqual([
      { key: 'src/shared/', text: 'lógica pura compartida' },
      { key: 'src/renderer/', text: 'sin acceso a Node' },
    ])
  })

  it('usa el cuerpo entero cuando no hay región auto', () => {
    const parsed = parseContextDoc('# notas\n\nTexto suelto del usuario.')
    expect(parsed.auto).toBe('# notas\n\nTexto suelto del usuario.')
    expect(parsed.notes).toBe('')
    expect(parsed.annotations).toEqual([])
  })

  it('descarta los placeholders del host', () => {
    const raw = [
      '<!-- iaterminal:auto -->',
      '(empty)',
      '<!-- /iaterminal:auto -->',
      '<!-- iaterminal:notes -->',
      '(no annotations yet)',
      '<!-- /iaterminal:notes -->',
    ].join('\n')
    const parsed = parseContextDoc(raw)
    expect(parsed.auto).toBe('')
    expect(parsed.notes).toBe('')
  })

  it('deja las notas vacías cuando solo hay anotaciones', () => {
    const raw = [
      '<!-- iaterminal:notes -->',
      '- `package.json` — manifiesto',
      '<!-- /iaterminal:notes -->',
    ].join('\n')
    const parsed = parseContextDoc(raw)
    expect(parsed.notes).toBe('')
    expect(parsed.annotations).toHaveLength(1)
  })

  it('no confunde el marcador de contexto con contenido', () => {
    const parsed = parseContextDoc(doc)
    expect(parsed.auto).not.toContain('iaterminal:context')
  })
})

describe('splitFences', () => {
  it('separa los bloques cercados del texto', () => {
    const body = ['### src/a.ts', '```ts', 'const a = 1', '```', 'cola'].join('\n')
    expect(splitFences(body)).toEqual([
      { fence: false, lang: '', text: '### src/a.ts' },
      { fence: true, lang: 'ts', text: 'const a = 1' },
      { fence: false, lang: '', text: 'cola' },
    ])
  })

  it('cierra el último fence aunque el archivo se corte', () => {
    const body = ['```json', '{ "a": 1 }'].join('\n')
    expect(splitFences(body)).toEqual([{ fence: true, lang: 'json', text: '{ "a": 1 }' }])
  })

  it('devuelve un solo tramo cuando no hay fences', () => {
    expect(splitFences('solo texto')).toEqual([{ fence: false, lang: '', text: 'solo texto' }])
  })

  it('ignora los tramos vacíos', () => {
    expect(splitFences('')).toEqual([])
  })
})
