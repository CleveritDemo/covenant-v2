import { describe, expect, it } from 'vitest'
import { countFolderNodes, parseContextDoc, parseFolderTree, splitFences, parseDeps, parseGit, contextReportCounts } from '../contextReportDoc'

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

const tree = [
  'gravity/  (project root; paths are relative to this folder)',
  '',
  'electron/',
  '  electron/__tests__/',
  'src/',
  '  src/renderer/',
  '    src/renderer/agent/',
  '    src/renderer/workspace/',
  '  src/shared/',
].join('\n')

describe('parseFolderTree', () => {
  it('anida por indentación y guarda solo el último segmento', () => {
    const { root, nodes } = parseFolderTree(tree)
    expect(root).toBe('gravity/')
    expect(nodes.map(node => node.name)).toEqual(['electron', 'src'])
    expect(nodes[1].children.map(node => node.name)).toEqual(['renderer', 'shared'])
    expect(nodes[1].children[0].children.map(node => node.name)).toEqual(['agent', 'workspace'])
  })

  it('conserva la ruta completa para identificar el nodo', () => {
    const { nodes } = parseFolderTree(tree)
    expect(nodes[1].children[0].path).toBe('src/renderer')
    expect(nodes[1].children[0].children[1].path).toBe('src/renderer/workspace')
  })

  it('cuenta todos los nodos, no solo los de primer nivel', () => {
    expect(countFolderNodes(parseFolderTree(tree).nodes)).toBe(7)
  })

  it('conserva la línea de truncado como hoja', () => {
    const { nodes } = parseFolderTree(['src/', '  … (truncated: line limit)'].join('\n'))
    expect(nodes[0].children[0]).toMatchObject({
      name: '… (truncated: line limit)',
      truncated: true,
      children: [],
    })
  })

  it('devuelve un árbol vacío sin reventar', () => {
    expect(parseFolderTree('')).toEqual({ root: '', nodes: [] })
    expect(parseFolderTree('(invalid cwd)')).toEqual({ root: '', nodes: [] })
  })
})

describe('parseDeps', () => {
  it('lee dependencias, dev y scripts de un package.json', () => {
    const manifest = JSON.stringify({
      name: 'gravity',
      dependencies: { react: '^18.2.0' },
      devDependencies: { vitest: '^1.6.0', typescript: '~5.4.0' },
      scripts: { dev: 'electron-vite dev', test: 'vitest run' },
    })
    expect(parseDeps(manifest)).toEqual({
      deps: [{ name: 'react', version: '^18.2.0' }],
      devDeps: [
        { name: 'vitest', version: '^1.6.0' },
        { name: 'typescript', version: '~5.4.0' },
      ],
      scripts: [
        { name: 'dev', command: 'electron-vite dev' },
        { name: 'test', command: 'vitest run' },
      ],
    })
  })

  it('devuelve listas vacías si el JSON no trae esas claves', () => {
    expect(parseDeps('{"name":"gravity"}')).toEqual({ deps: [], devDeps: [], scripts: [] })
  })

  it('devuelve null con un manifiesto que no es JSON', () => {
    expect(parseDeps('[package]\nname = "gravity"')).toBeNull()
    expect(parseDeps('(no dependency manifest found)')).toBeNull()
  })
})

describe('parseGit', () => {
  const status = [
    'Git status:',
    '## main...origin/main [ahead 1]',
    ' M electron/main.ts',
    '?? src/shared/contextReportDoc.ts',
    '',
    'Diff stat:',
    ' electron/main.ts | 12 ++++--',
    ' 1 file changed, 10 insertions(+), 2 deletions(-)',
  ].join('\n')

  it('saca rama, cambios y diff stat', () => {
    const parsed = parseGit(status)
    expect(parsed?.branch).toBe('main')
    expect(parsed?.changes).toEqual([
      { code: 'M', path: 'electron/main.ts' },
      { code: '??', path: 'src/shared/contextReportDoc.ts' },
    ])
    expect(parsed?.diffStat).toContain('1 file changed')
  })

  it('trata el repo limpio como cero cambios', () => {
    const clean = ['Git status:', '## main', '(clean)', '', 'Diff stat:', '(no changes)'].join('\n')
    expect(parseGit(clean)).toEqual({ branch: 'main', changes: [], diffStat: '' })
  })

  it('devuelve null si no es un repo', () => {
    expect(parseGit('(not a git repository or git unavailable)')).toBeNull()
  })
})

describe('contextReportCounts', () => {
  const wrap = (auto: string, notes = ''): string => [
    '<!-- iaterminal:auto -->',
    auto,
    '<!-- /iaterminal:auto -->',
    '<!-- iaterminal:notes -->',
    notes,
    '<!-- /iaterminal:notes -->',
  ].join('\n')

  it('cuenta carpetas del árbol', () => {
    const doc = parseContextDoc(wrap(['src/', '  src/shared/'].join('\n')))
    expect(contextReportCounts('folderTree', doc)).toEqual([{ key: 'folders', count: 2 }])
  })

  it('cuenta dependencias y scripts por separado', () => {
    const manifest = JSON.stringify({
      dependencies: { react: '18' },
      devDependencies: { vitest: '1' },
      scripts: { dev: 'x' },
    })
    const doc = parseContextDoc(wrap(manifest))
    expect(contextReportCounts('deps', doc)).toEqual([
      { key: 'deps', count: 2 },
      { key: 'scripts', count: 1 },
    ])
  })

  it('cuenta los cambios de git', () => {
    const doc = parseContextDoc(wrap(['Git status:', '## main', ' M a.ts'].join('\n')))
    expect(contextReportCounts('git', doc)).toEqual([{ key: 'changes', count: 1 }])
  })

  it('cuenta archivos y símbolos por sus encabezados', () => {
    const symbols = ['### a.ts', '- Foo', '- Foo.bar', '### b.ts', '- baz'].join('\n')
    expect(contextReportCounts('symbols', parseContextDoc(wrap(symbols)))).toEqual([
      { key: 'files', count: 2 },
      { key: 'symbols', count: 3 },
    ])
    const files = ['### a.ts', '```ts', 'const a = 1', '```'].join('\n')
    expect(contextReportCounts('files', parseContextDoc(wrap(files)))).toEqual([
      { key: 'files', count: 1 },
    ])
  })

  it('añade las anotaciones a cualquier kind', () => {
    const doc = parseContextDoc(wrap('# Léeme', '- `a.ts` — nota'))
    expect(contextReportCounts('readme', doc)).toEqual([{ key: 'annotations', count: 1 }])
  })

  it('no cuenta nada cuando el parser específico no aplica', () => {
    const doc = parseContextDoc(wrap('[package]\nname = "gravity"'))
    expect(contextReportCounts('deps', doc)).toEqual([])
  })
})
