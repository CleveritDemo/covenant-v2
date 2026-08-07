# Vista «Reporte» para los contextos de proyecto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la pestaña **Reporte** del modal de contextos funcione para todos los kinds, no sólo `agentResult`, con vista dedicada para `folderTree` (árbol plegable) y `deps` (dependencias y scripts).

**Architecture:** Todo el parseo vive en un módulo puro nuevo, `src/shared/contextReportDoc.ts`, con tests en vitest; el renderer añade un componente `ContextReport` que sólo elige qué pintar. `ContextContentPreviewModal` pasa de condicionar el toggle a `agentResult` a mostrarlo siempre. Nada cruza IPC: el modal ya tiene el `.md` entero en memoria vía `previewTabContext`.

**Tech Stack:** TypeScript, React 18, vitest (entorno `node` para lógica pura), i18next (`en` + `es`), CSS colocado con clases BEM.

**Spec:** `docs/superpowers/specs/2026-08-07-context-report-view-design.md`

## Global Constraints

- Los comentarios y la documentación se escriben **en español**; el código, en inglés.
- Los marcadores en disco son `<!-- iaterminal:auto -->` / `<!-- /iaterminal:auto -->` y `<!-- iaterminal:notes -->` / `<!-- /iaterminal:notes -->`. **No se renombran** aunque la carpeta del proyecto ya sea `.gravity`: viven dentro de los Markdown de los usuarios (ver `CLAUDE.md`).
- La lógica de decisión va en `src/shared/` como función pura; React es un driver fino. No importar nada de `electron/` desde `src/renderer/` ni desde `src/shared/`.
- Los componentes del UI kit (`src/renderer/components/ui/**`) no aceptan `className` ni `style`. `npm run check:ui` falla si se les pasa.
- Toda cadena visible pasa por i18n y **se añade a los dos locales** (`src/i18n/locales/en.ts` y `es.ts`) en el mismo commit.
- `npx tsc -b` arrastra ~36 errores previos en 11 archivos: no es una puerta de paso/fallo. Compara el número antes y después, no esperes cero.
- El árbol de trabajo tiene cambios sin commitear del rebrand `.iaterminal` → `.gravity`. **No los incluyas en tus commits**: usa `git add` con rutas explícitas, nunca `git add -A`.

---

### Task 1: Parseo del documento — regiones y fences

**Files:**
- Create: `src/shared/contextReportDoc.ts`
- Test: `src/shared/__tests__/contextReportDoc.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface ContextDoc { auto: string; notes: string; annotations: ContextAnnotation[] }`
  - `interface ContextAnnotation { key: string; text: string }`
  - `parseContextDoc(raw: string): ContextDoc`
  - `interface FenceChunk { fence: boolean; lang: string; text: string }`
  - `splitFences(body: string): FenceChunk[]`

- [ ] **Step 1: Escribe el test que falla**

Crea `src/shared/__tests__/contextReportDoc.test.ts`:

```ts
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
```

- [ ] **Step 2: Ejecuta el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: FAIL — `Failed to resolve import "../contextReportDoc"`.

- [ ] **Step 3: Implementa el mínimo**

Crea `src/shared/contextReportDoc.ts`:

```ts
/**
 * Parseo puro del Markdown de un contexto para la vista Reporte.
 * El formato canónico lo escribe `electron/tabContextBuild.ts`; aquí solo se lee.
 */

export interface ContextAnnotation {
  key: string
  text: string
}

export interface ContextDoc {
  /** Región `iaterminal:auto`, o el cuerpo entero si el documento no la tiene. */
  auto: string
  /** Texto libre humano de `iaterminal:notes`, sin las líneas de anotación. */
  notes: string
  /** Líneas `- \`clave\` — texto` de `iaterminal:notes`. */
  annotations: ContextAnnotation[]
}

const AUTO_RE = /<!--\s*iaterminal:auto\s*-->([\s\S]*?)<!--\s*\/iaterminal:auto\s*-->/
const NOTES_RE = /<!--\s*iaterminal:notes\s*-->([\s\S]*?)<!--\s*\/iaterminal:notes\s*-->/
// La misma forma que ANNOTATION_RE en electron/tabContextBuild.ts.
const ANNOTATION_RE = /^-\s+`([^`]+)`\s+—\s+(.+?)\s*$/gm

// Lo que escribe el host cuando no hay contenido real; para la vista es vacío.
const PLACEHOLDERS = new Set([
  '(empty)',
  '(empty notes)',
  '(no annotations yet)',
  '(no results yet)',
])

function clean(value: string): string {
  const trimmed = value.trim()
  return PLACEHOLDERS.has(trimmed) ? '' : trimmed
}

export function parseContextDoc(raw: string): ContextDoc {
  const source = raw.replace(/\r\n/g, '\n')
  const notesRegion = source.match(NOTES_RE)?.[1] ?? ''
  const auto = source.match(AUTO_RE)?.[1]
    // Sin región auto (notas del usuario, changelog): el cuerpo menos los marcadores.
    ?? source.replace(NOTES_RE, '').replace(/<!--[\s\S]*?-->/g, '')

  const annotations = [...notesRegion.matchAll(ANNOTATION_RE)].map(match => ({
    key: match[1].trim(),
    text: match[2].trim(),
  }))

  const notes = notesRegion
    .replace(ANNOTATION_RE, '')
    // El host agrupa bajo este encabezado las anotaciones huérfanas; sin ellas sobra.
    .replace(/^##\s+Orphaned\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')

  return { auto: clean(auto), notes: clean(notes), annotations }
}

export interface FenceChunk {
  fence: boolean
  lang: string
  text: string
}

const FENCE_RE = /^\s*```(\S*)\s*$/

/**
 * Trocea un cuerpo Markdown en tramos cercados y no cercados.
 * `AiMarkdown` no soporta bloques de código, así que los fences se pintan aparte.
 */
export function splitFences(body: string): FenceChunk[] {
  const out: FenceChunk[] = []
  let lines: string[] = []
  let lang: string | null = null

  const flush = (): void => {
    const text = lines.join('\n').trim()
    if (text) out.push({ fence: lang !== null, lang: lang ?? '', text })
    lines = []
  }

  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const fence = line.match(FENCE_RE)
    if (!fence) {
      lines.push(line)
      continue
    }
    if (lang === null) {
      flush()
      lang = fence[1]
    } else {
      flush()
      lang = null
    }
  }
  // Un fence sin cerrar (archivo truncado) se cierra solo.
  flush()
  return out
}
```

- [ ] **Step 4: Ejecuta el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contextReportDoc.ts src/shared/__tests__/contextReportDoc.test.ts
git commit -m "Parsea las regiones y los fences de un contexto"
```

---

### Task 2: Árbol de carpetas

**Files:**
- Modify: `src/shared/contextReportDoc.ts`
- Test: `src/shared/__tests__/contextReportDoc.test.ts`

**Interfaces:**
- Consumes: `ContextDoc.auto` de la Task 1.
- Produces:
  - `interface FolderNode { name: string; path: string; truncated: boolean; children: FolderNode[] }`
  - `parseFolderTree(auto: string): { root: string; nodes: FolderNode[] }`
  - `countFolderNodes(nodes: readonly FolderNode[]): number`

Formato de entrada, fijado por `gatherShallowFolderTree()` en `electron/agentMd.ts`: primera línea `<nombre>/  (project root; paths are relative to this folder)`, línea en blanco, y luego una línea por carpeta con **ruta relativa completa** e indentación de dos espacios por nivel. Al llegar al límite añade `<indent>… (truncated: line limit)`.

- [ ] **Step 1: Escribe el test que falla**

Añade al final de `src/shared/__tests__/contextReportDoc.test.ts` (y amplía el import de la primera línea a `import { countFolderNodes, parseContextDoc, parseFolderTree, splitFences } from '../contextReportDoc'`):

```ts
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
    expect(countFolderNodes(parseFolderTree(tree).nodes)).toBe(6)
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
```

- [ ] **Step 2: Ejecuta el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: FAIL — `parseFolderTree is not a function`.

- [ ] **Step 3: Implementa el mínimo**

Añade a `src/shared/contextReportDoc.ts`:

```ts
export interface FolderNode {
  /** Último segmento de la ruta; el render le pone la barra. */
  name: string
  /** Ruta relativa completa: identidad del nodo para el plegado. */
  path: string
  /** Línea `… (truncated: line limit)` del generador; se pinta tal cual. */
  truncated: boolean
  children: FolderNode[]
}

// La línea raíz del generador: `gravity/  (project root; paths are relative…)`.
const TREE_ROOT_RE = /^(\S+\/)\s+\(project root/
const TRUNCATED = '…'

/** Árbol indentado de `gatherShallowFolderTree()` → nodos anidados. */
export function parseFolderTree(auto: string): { root: string; nodes: FolderNode[] } {
  const nodes: FolderNode[] = []
  // stack[d] es el último nodo visto a profundidad d; el padre está en stack[d - 1].
  const stack: FolderNode[] = []
  let root = ''

  for (const line of auto.replace(/\r\n/g, '\n').split('\n')) {
    const text = line.trim()
    if (!text) continue
    const rootMatch = text.match(TREE_ROOT_RE)
    if (rootMatch) {
      root = rootMatch[1]
      continue
    }
    // `(invalid cwd)`, `(could not read directory)`: no hay árbol que pintar.
    if (text.startsWith('(')) continue

    const depth = Math.floor((line.length - line.trimStart().length) / 2)
    const truncated = text.startsWith(TRUNCATED)
    const path = truncated ? `${stack[depth - 1]?.path ?? ''}/${TRUNCATED}` : text.replace(/\/$/, '')
    const node: FolderNode = {
      name: truncated ? text : path.split('/').pop() ?? path,
      path,
      truncated,
      children: [],
    }
    const parent = stack[depth - 1]
    if (parent) parent.children.push(node)
    else nodes.push(node)
    stack[depth] = node
    stack.length = depth + 1
  }

  return { root, nodes }
}

export function countFolderNodes(nodes: readonly FolderNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countFolderNodes(node.children), 0)
}
```

- [ ] **Step 4: Ejecuta el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contextReportDoc.ts src/shared/__tests__/contextReportDoc.test.ts
git commit -m "Parsea el árbol de carpetas de un contexto folderTree"
```

---

### Task 3: Dependencias y git

**Files:**
- Modify: `src/shared/contextReportDoc.ts`
- Test: `src/shared/__tests__/contextReportDoc.test.ts`

**Interfaces:**
- Consumes: `ContextDoc.auto` de la Task 1.
- Produces:
  - `interface DepsDoc { deps: DepEntry[]; devDeps: DepEntry[]; scripts: ScriptEntry[] }`
  - `interface DepEntry { name: string; version: string }`
  - `interface ScriptEntry { name: string; command: string }`
  - `parseDeps(auto: string): DepsDoc | null` — `null` = manifiesto que no es JSON.
  - `interface GitDoc { branch: string; changes: GitChange[]; diffStat: string }`
  - `interface GitChange { code: string; path: string }`
  - `parseGit(auto: string): GitDoc | null` — `null` = no es un repo git.

`buildAutoContent()` vuelca el manifiesto en bruto para `deps` (el primero que exista de `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`). `buildGit()` escribe `Git status:\n<git status --short --branch>\n\nDiff stat:\n<git diff --stat HEAD>`.

- [ ] **Step 1: Escribe el test que falla**

Añade a `src/shared/__tests__/contextReportDoc.test.ts` (y a su import: `parseDeps`, `parseGit`):

```ts
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
```

- [ ] **Step 2: Ejecuta el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: FAIL — `parseDeps is not a function`.

- [ ] **Step 3: Implementa el mínimo**

Añade a `src/shared/contextReportDoc.ts`:

```ts
export interface DepEntry {
  name: string
  version: string
}

export interface ScriptEntry {
  name: string
  command: string
}

export interface DepsDoc {
  deps: DepEntry[]
  devDeps: DepEntry[]
  scripts: ScriptEntry[]
}

function stringEntries(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item)])
}

/** `null` cuando el manifiesto no es JSON (Cargo.toml, go.mod…): cae a la vista genérica. */
export function parseDeps(auto: string): DepsDoc | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(auto)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const manifest = parsed as Record<string, unknown>
  return {
    deps: stringEntries(manifest.dependencies).map(([name, version]) => ({ name, version })),
    devDeps: stringEntries(manifest.devDependencies).map(([name, version]) => ({ name, version })),
    scripts: stringEntries(manifest.scripts).map(([name, command]) => ({ name, command })),
  }
}

export interface GitChange {
  /** Código de dos letras de `git status --short`: `M`, `??`, `A`… */
  code: string
  path: string
}

export interface GitDoc {
  branch: string
  changes: GitChange[]
  diffStat: string
}

const DIFF_MARKER = '\n\nDiff stat:\n'

export function parseGit(auto: string): GitDoc | null {
  const body = auto.replace(/\r\n/g, '\n')
  const split = body.indexOf(DIFF_MARKER)
  const statusBlock = (split < 0 ? body : body.slice(0, split))
    .replace(/^Git status:\s*/, '')
    .trim()
  if (!statusBlock || statusBlock.startsWith('(')) return null

  const lines = statusBlock.split('\n')
  const hasBranch = lines[0].startsWith('##')
  // `## main...origin/main [ahead 1]` → `main`.
  const branch = hasBranch ? lines[0].slice(2).trim().split(/\.{3}|\s+/)[0] : ''
  const changes = lines
    .slice(hasBranch ? 1 : 0)
    .filter(line => line.trim() && !line.trim().startsWith('('))
    .map(line => ({ code: line.slice(0, 2).trim(), path: line.slice(2).trim() }))

  const diffStat = split < 0 ? '' : body.slice(split + DIFF_MARKER.length).trim()
  return { branch, changes, diffStat: diffStat.startsWith('(') ? '' : diffStat }
}
```

- [ ] **Step 4: Ejecuta el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: PASS — 20 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contextReportDoc.ts src/shared/__tests__/contextReportDoc.test.ts
git commit -m "Parsea el manifiesto de dependencias y el estado de git"
```

---

### Task 4: Recuentos del meta

**Files:**
- Modify: `src/shared/contextReportDoc.ts`
- Test: `src/shared/__tests__/contextReportDoc.test.ts`

**Interfaces:**
- Consumes: `ContextDoc`, `parseFolderTree`, `countFolderNodes`, `parseDeps`, `parseGit`.
- Produces: `contextReportCounts(kind: TabContextKind, doc: ContextDoc): ContextReportCount[]`, con `interface ContextReportCount { key: string; count: number }`.

Las claves (`folders`, `deps`, `scripts`, `changes`, `files`, `symbols`, `annotations`) son las que la Task 5 traduce como `tabContexts.reportCount_<key>`. Sustituyen a `0 keys · 0 annotated`, que sigue vivo sólo en la vista Fuente.

- [ ] **Step 1: Escribe el test que falla**

Añade a `src/shared/__tests__/contextReportDoc.test.ts` (import: `contextReportCounts`):

```ts
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
```

- [ ] **Step 2: Ejecuta el test y verifica que falla**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: FAIL — `contextReportCounts is not a function`.

- [ ] **Step 3: Implementa el mínimo**

Añade a `src/shared/contextReportDoc.ts` (y al principio del archivo, `import type { TabContextKind } from './tabContext'`):

```ts
export interface ContextReportCount {
  /** Clave de i18n: `tabContexts.reportCount_<key>`, con plural `_one` / `_other`. */
  key: string
  count: number
}

function countMatches(body: string, pattern: RegExp): number {
  return [...body.matchAll(pattern)].length
}

/** Recuentos del meta, ya resueltos por kind; el componente solo los traduce. */
export function contextReportCounts(kind: TabContextKind, doc: ContextDoc): ContextReportCount[] {
  const out: ContextReportCount[] = []
  switch (kind) {
    case 'folderTree': {
      const total = countFolderNodes(parseFolderTree(doc.auto).nodes)
      if (total) out.push({ key: 'folders', count: total })
      break
    }
    case 'deps': {
      const deps = parseDeps(doc.auto)
      if (deps) {
        out.push({ key: 'deps', count: deps.deps.length + deps.devDeps.length })
        out.push({ key: 'scripts', count: deps.scripts.length })
      }
      break
    }
    case 'git': {
      const git = parseGit(doc.auto)
      if (git) out.push({ key: 'changes', count: git.changes.length })
      break
    }
    case 'files':
      // `### <ruta>` por archivo, tal como los emite buildFiles().
      out.push({ key: 'files', count: countMatches(doc.auto, /^###\s+\S/gm) })
      break
    case 'symbols':
      out.push({ key: 'files', count: countMatches(doc.auto, /^###\s+\S/gm) })
      out.push({ key: 'symbols', count: countMatches(doc.auto, /^-\s+\S/gm) })
      break
    default:
      break
  }
  if (doc.annotations.length) out.push({ key: 'annotations', count: doc.annotations.length })
  return out
}
```

- [ ] **Step 4: Ejecuta el test y verifica que pasa**

Run: `npx vitest run src/shared/__tests__/contextReportDoc.test.ts`
Expected: PASS — 26 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/contextReportDoc.ts src/shared/__tests__/contextReportDoc.test.ts
git commit -m "Resuelve los recuentos del meta del Reporte por kind"
```

---

### Task 5: Reporte genérico, notas y enganche en el modal

Primera tarea visible en la app: al terminarla, cualquier contexto tiene pestaña Reporte.

**Files:**
- Create: `src/renderer/workspace/ContextReport.tsx`, `src/renderer/workspace/ContextReport.css`
- Modify: `src/renderer/workspace/ContextContentPreviewModal.tsx`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `parseContextDoc`, `splitFences`, `contextReportCounts` de las Tasks 1 y 4.
- Produces: `<ContextReport context={TabContext} content={string} />` y `contextReportMetaText(kind, doc, t): string`, que el modal usa para la primera `<small>` del meta.

Nota sobre el meta: el spec decía que el meta lo pintara `ContextReport`. Se queda en el modal, porque su CSS ancla la ruta con `.tab-contexts__preview-meta > small:nth-of-type(2)`; moverla rompería el layout sin ganar nada. `ContextReport` sólo expone el texto.

- [ ] **Step 1: Añade las claves de i18n a los dos locales**

En `src/i18n/locales/en.ts`, dentro de `tabContexts`, después de `resultsNotesSaveFailed`:

```ts
    reportCount_folders_one: '{{count}} folder',
    reportCount_folders_other: '{{count}} folders',
    reportCount_deps_one: '{{count}} dependency',
    reportCount_deps_other: '{{count}} dependencies',
    reportCount_scripts_one: '{{count}} script',
    reportCount_scripts_other: '{{count}} scripts',
    reportCount_changes_one: '{{count}} change',
    reportCount_changes_other: '{{count}} changes',
    reportCount_files_one: '{{count}} file',
    reportCount_files_other: '{{count}} files',
    reportCount_symbols_one: '{{count}} symbol',
    reportCount_symbols_other: '{{count}} symbols',
    reportCount_annotations_one: '{{count}} annotated',
    reportCount_annotations_other: '{{count}} annotated',
    reportNotesTitle: 'Notes',
    reportNotesByAi: 'AI',
    reportEmpty: 'This context has no content yet.',
```

Lo mismo en `src/i18n/locales/es.ts`:

```ts
    reportCount_folders_one: '{{count}} carpeta',
    reportCount_folders_other: '{{count}} carpetas',
    reportCount_deps_one: '{{count}} dependencia',
    reportCount_deps_other: '{{count}} dependencias',
    reportCount_scripts_one: '{{count}} script',
    reportCount_scripts_other: '{{count}} scripts',
    reportCount_changes_one: '{{count}} cambio',
    reportCount_changes_other: '{{count}} cambios',
    reportCount_files_one: '{{count}} archivo',
    reportCount_files_other: '{{count}} archivos',
    reportCount_symbols_one: '{{count}} símbolo',
    reportCount_symbols_other: '{{count}} símbolos',
    reportCount_annotations_one: '{{count}} anotada',
    reportCount_annotations_other: '{{count}} anotadas',
    reportNotesTitle: 'Notas',
    reportNotesByAi: 'IA',
    reportEmpty: 'Este contexto aún no tiene contenido.',
```

- [ ] **Step 2: Crea el componente**

`src/renderer/workspace/ContextReport.tsx`:

```tsx
import React, { useMemo } from 'react'
import type { TFunction } from 'i18next'
import type { TabContext, TabContextKind } from '@shared/tabContext'
import {
  contextReportCounts,
  parseContextDoc,
  splitFences,
  type ContextDoc,
} from '@shared/contextReportDoc'
import { useT } from '@i18n/useT'
import { AiMarkdown } from '../components/AiMarkdown'
import './ContextReport.css'

/** Texto de la primera `<small>` del meta: `148 carpetas · 3 anotadas`. */
export function contextReportMetaText(
  kind: TabContextKind,
  doc: ContextDoc,
  t: TFunction<'app'>,
): string {
  return contextReportCounts(kind, doc)
    .map(count => t(`tabContexts.reportCount_${count.key}`, { count: count.count }))
    .join(' · ')
}

/** Notas humanas y anotaciones por clave. Solo lectura: escribirlas exige un IPC nuevo. */
const ContextNotes: React.FC<{ doc: ContextDoc }> = ({ doc }) => {
  const { t } = useT()
  if (!doc.notes && !doc.annotations.length) return null

  return (
    <section className="context-report__notes">
      <header>
        <h3>{t('tabContexts.reportNotesTitle')}</h3>
        <span className="context-report__prov">{t('tabContexts.reportNotesByAi')}</span>
      </header>
      {doc.notes ? <p className="context-report__notes-text">{doc.notes}</p> : null}
      {doc.annotations.length ? (
        <dl className="context-report__annotations">
          {doc.annotations.map(annotation => (
            <div key={annotation.key}>
              <dt>{annotation.key}</dt>
              <dd>{annotation.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  )
}

/** Cuerpo por defecto: fences en `<pre>`, el resto por el markdown del chat. */
const GenericBody: React.FC<{ auto: string }> = ({ auto }) => {
  const { t } = useT()
  const chunks = useMemo(() => splitFences(auto), [auto])
  if (!chunks.length) return <p className="context-report__empty">{t('tabContexts.reportEmpty')}</p>

  return (
    <>
      {chunks.map((chunk, index) => (
        chunk.fence
          ? <pre key={index} className="context-report__code">{chunk.text}</pre>
          : <AiMarkdown key={index} content={chunk.text} />
      ))}
    </>
  )
}

/** Cada kind con vista dedicada añade su caso; el resto cae en el genérico. */
const ContextBody: React.FC<{ kind: TabContextKind; auto: string }> = ({ kind, auto }) => {
  switch (kind) {
    default:
      return <GenericBody auto={auto} />
  }
}

/** Lectura humana de un contexto de proyecto; `agentResult` tiene la suya aparte. */
export const ContextReport: React.FC<{ context: TabContext; content: string }> = ({
  context,
  content,
}) => {
  const doc = useMemo(() => parseContextDoc(content), [content])

  return (
    <div className="context-report">
      <ContextBody kind={context.kind} auto={doc.auto} />
      <ContextNotes doc={doc} />
    </div>
  )
}
```

`AiMarkdown` es un export con nombre (`src/renderer/components/AiMarkdown.tsx:253`) y sólo necesita `content`.

- [ ] **Step 3: Crea el CSS**

`src/renderer/workspace/ContextReport.css`:

```css
/* Cuerpo desplazable del Reporte; el meta y el toggle los pinta el modal. */
.context-report {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 12px 2px 4px;
  overflow-y: auto;
}

.context-report__code {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
}

.context-report__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.context-report__notes {
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.context-report__notes > header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.context-report__notes > header > h3 {
  margin: 0;
  font-size: 13px;
}

.context-report__prov {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-muted);
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.context-report__notes-text {
  margin: 0 0 10px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.context-report__annotations {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
  font-size: 12px;
}

.context-report__annotations > div {
  display: contents;
}

.context-report__annotations dt {
  font-family: var(--font-mono);
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.context-report__annotations dd {
  margin: 0;
}
```

Los tokens son los que ya usa `ContextContentPreviewModal.css`: `--border`, `--surface`, `--text-muted`, `--font-mono`.

- [ ] **Step 4: Engancha el modal**

En `src/renderer/workspace/ContextContentPreviewModal.tsx`:

1. Añade a los imports: `import { parseContextDoc } from '@shared/contextReportDoc'` y `import { ContextReport, contextReportMetaText } from './ContextReport'`.
2. Dentro de `ContextPreviewBody`, junto al `doc` existente, añade el documento genérico:

```tsx
  const contextDoc = useMemo(
    () => (preview.status === 'success' ? parseContextDoc(preview.content) : null),
    [preview],
  )
```

3. Sustituye el contenido de la primera `<small>` del meta por:

```tsx
            <small>
              {view === 'source'
                ? t('tabContexts.previewStats', {
                  auto: countAutoKeys(preview.content),
                  notes: countAnnotations(preview.content),
                })
                : doc
                  ? [
                    doc.entries.length ? t('tabContexts.resultsEntries', { count: doc.entries.length }) : '',
                    doc.notes ? t('tabContexts.resultsHasNotes') : '',
                  ].filter(Boolean).join(' · ')
                  : contextDoc
                    ? contextReportMetaText(context.kind, contextDoc, t)
                    : ''}
            </small>
```

4. Quita la condición `doc ?` del `SegmentedControl` para que se muestre siempre (deja el resto de props igual).
5. Cambia el cuerpo:

```tsx
          {view === 'source' ? (
            <pre className="tab-contexts__preview">{preview.content}</pre>
          ) : doc ? (
            <AgentResultsReport
              doc={doc}
              agentName={context.name.trim()}
              consumers={consumers}
              onSaveNotes={saveNotes}
            />
          ) : (
            <ContextReport context={context} content={preview.content} />
          )}
```

- [ ] **Step 5: Verifica**

```bash
npm test
npm run check:ui
npx tsc -b 2>&1 | tail -3
```

Expected: los ~466 tests siguen pasando, `check:ui` sin violaciones, y el conteo de errores de `tsc` igual que antes de la tarea (compáralo con `git stash && npx tsc -b 2>&1 | tail -3` si dudas).

Luego, a ojo con `npm run dev`: abre el gestor de contextos, entra en un contexto `readme` o `notes` y comprueba que (a) el toggle Reporte/Fuente aparece, (b) Reporte no muestra ningún `<!-- iaterminal:… -->`, (c) Fuente sigue mostrando el `.md` entero, (d) si el contexto tiene anotaciones, salen bajo Notas.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/workspace/ContextReport.tsx src/renderer/workspace/ContextReport.css \
        src/renderer/workspace/ContextContentPreviewModal.tsx \
        src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Extiende la vista Reporte a todos los contextos"
```

---

### Task 6: Árbol plegable para `folderTree`

**Files:**
- Modify: `src/renderer/workspace/ContextReport.tsx`, `src/renderer/workspace/ContextReport.css`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `parseFolderTree`, `countFolderNodes`, `FolderNode` de la Task 2.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Añade las claves de i18n a los dos locales**

En `tabContexts` de `en.ts`: `reportTreeToggle: 'Show subfolders',`
En `es.ts`: `reportTreeToggle: 'Ver subcarpetas',`

- [ ] **Step 2: Implementa el árbol**

En `src/renderer/workspace/ContextReport.tsx`, amplía el import de `@shared/contextReportDoc` con `countFolderNodes`, `parseFolderTree` y `type FolderNode`, añade `useState` al import de React, y añade el componente antes de `ContextReport`:

```tsx
/** Rutas abiertas al montar: los dos primeros niveles. */
function initialOpenPaths(nodes: readonly FolderNode[], depth = 0): string[] {
  if (depth >= 2) return []
  return nodes.flatMap(node => [node.path, ...initialOpenPaths(node.children, depth + 1)])
}

const FolderTreeNode: React.FC<{
  node: FolderNode
  open: Set<string>
  onToggle: (path: string) => void
}> = ({ node, open, onToggle }) => {
  const { t } = useT()
  const expandable = node.children.length > 0
  const expanded = open.has(node.path)

  return (
    <li className="context-report__tree-node">
      <div className="context-report__tree-row">
        {expandable ? (
          <button
            type="button"
            className="context-report__tree-chevron"
            aria-expanded={expanded}
            aria-label={t('tabContexts.reportTreeToggle')}
            onClick={() => onToggle(node.path)}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="context-report__tree-chevron" aria-hidden />
        )}
        <span className={node.truncated ? 'context-report__tree-truncated' : 'context-report__tree-name'}>
          {node.truncated ? node.name : `${node.name}/`}
        </span>
        {expandable ? (
          <span className="context-report__tree-count">{countFolderNodes(node.children)}</span>
        ) : null}
      </div>
      {expandable && expanded ? (
        <ul className="context-report__tree">
          {node.children.map(child => (
            <FolderTreeNode key={child.path} node={child} open={open} onToggle={onToggle} />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

const FolderTreeBody: React.FC<{ auto: string }> = ({ auto }) => {
  const { root, nodes } = useMemo(() => parseFolderTree(auto), [auto])
  // El estado no se persiste: al reabrir el modal se vuelve a los dos niveles.
  const [open, setOpen] = useState(() => new Set(initialOpenPaths(nodes)))
  const toggle = (path: string): void => {
    setOpen(current => {
      const next = new Set(current)
      if (!next.delete(path)) next.add(path)
      return next
    })
  }

  if (!nodes.length) return <GenericBody auto={auto} />

  return (
    <div className="context-report__tree-wrap">
      {root ? <p className="context-report__tree-root">{root}</p> : null}
      <ul className="context-report__tree">
        {nodes.map(node => (
          <FolderTreeNode key={node.path} node={node} open={open} onToggle={toggle} />
        ))}
      </ul>
    </div>
  )
}
```

Y añade su caso al switch de `ContextBody`, antes del `default`:

```tsx
    case 'folderTree':
      return <FolderTreeBody auto={auto} />
```

- [ ] **Step 3: Añade el CSS**

Al final de `src/renderer/workspace/ContextReport.css`:

```css
.context-report__tree-root {
  margin: 0 0 8px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.context-report__tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Solo los niveles anidados sangran; el primero cuelga del borde. */
.context-report__tree .context-report__tree {
  padding-left: 14px;
  border-left: 1px solid var(--border);
  margin-left: 7px;
}

.context-report__tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 22px;
}

.context-report__tree-chevron {
  width: 14px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-muted);
  font-size: 11px;
  line-height: 1;
  text-align: left;
  cursor: pointer;
}

.context-report__tree-name {
  font-family: var(--font-mono);
  font-size: 12px;
}

.context-report__tree-truncated {
  color: var(--text-muted);
  font-size: 12px;
}

.context-report__tree-count {
  color: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 4: Verifica**

```bash
npm test
npm run check:ui
```

Expected: sin cambios respecto a la Task 5.

A ojo con `npm run dev`, en un contexto `folderTree`: se ve el árbol anidado por último segmento, los dos primeros niveles abiertos, el chevron pliega y despliega, el contador cuadra con el número de subcarpetas, y el meta dice `N carpetas`.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/workspace/ContextReport.tsx src/renderer/workspace/ContextReport.css \
        src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Pinta el contexto folderTree como árbol plegable"
```

---

### Task 7: Dependencias y scripts para `deps`

**Files:**
- Modify: `src/renderer/workspace/ContextReport.tsx`, `src/renderer/workspace/ContextReport.css`
- Modify: `src/i18n/locales/en.ts`, `src/i18n/locales/es.ts`

**Interfaces:**
- Consumes: `parseDeps`, `DepsDoc` de la Task 3.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Añade las claves de i18n a los dos locales**

En `tabContexts` de `en.ts`:

```ts
    reportDeps: 'Dependencies',
    reportScripts: 'Scripts',
    reportDepDev: 'dev',
```

En `es.ts`:

```ts
    reportDeps: 'Dependencias',
    reportScripts: 'Scripts',
    reportDepDev: 'dev',
```

- [ ] **Step 2: Implementa la vista**

En `src/renderer/workspace/ContextReport.tsx`, amplía el import de `@shared/contextReportDoc` con `parseDeps` y añade antes de `ContextReport`:

```tsx
const DepsBody: React.FC<{ auto: string }> = ({ auto }) => {
  const { t } = useT()
  const deps = useMemo(() => parseDeps(auto), [auto])
  // Manifiesto que no es JSON (Cargo.toml, go.mod…): se lee como texto.
  if (!deps) return <GenericBody auto={auto} />

  const all = [
    ...deps.deps.map(dep => ({ ...dep, dev: false })),
    ...deps.devDeps.map(dep => ({ ...dep, dev: true })),
  ]

  return (
    <div className="context-report__deps">
      {all.length ? (
        <section>
          <h3>{t('tabContexts.reportDeps')}</h3>
          <ul className="context-report__dep-list">
            {all.map(dep => (
              <li key={`${dep.name}${dep.dev ? ':dev' : ''}`}>
                <span className="context-report__dep-name">{dep.name}</span>
                {dep.dev ? <span className="context-report__dep-dev">{t('tabContexts.reportDepDev')}</span> : null}
                <span className="context-report__dep-version">{dep.version}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {deps.scripts.length ? (
        <section>
          <h3>{t('tabContexts.reportScripts')}</h3>
          <ul className="context-report__script-list">
            {deps.scripts.map(script => (
              <li key={script.name}>
                <span className="context-report__dep-name">{script.name}</span>
                <code>{script.command}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!all.length && !deps.scripts.length ? <GenericBody auto={auto} /> : null}
    </div>
  )
}
```

Y añade su caso al switch de `ContextBody`, junto al de `folderTree`:

```tsx
    case 'deps':
      return <DepsBody auto={auto} />
```

- [ ] **Step 3: Añade el CSS**

Al final de `src/renderer/workspace/ContextReport.css`:

```css
.context-report__deps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.context-report__deps h3 {
  margin: 0 0 8px;
  font-size: 13px;
}

.context-report__dep-list,
.context-report__script-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 12px;
}

.context-report__dep-list > li {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-height: 22px;
}

.context-report__dep-name {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}

.context-report__dep-dev {
  padding: 0 5px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-muted);
  font-size: 10px;
}

.context-report__dep-version {
  margin-left: auto;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.context-report__script-list > li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}

.context-report__script-list code {
  color: var(--text-muted);
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
```

- [ ] **Step 4: Verifica**

```bash
npm test
npm run check:ui
npx tsc -b 2>&1 | tail -3
```

Expected: tests en verde, `check:ui` limpio, errores de `tsc` en el mismo número que al empezar el plan.

A ojo con `npm run dev`, en un contexto `deps` sobre un proyecto con `package.json`: dependencias con versión, las de desarrollo marcadas `dev`, scripts con su comando, y el meta con `N dependencias · N scripts`. En un proyecto con `Cargo.toml` o `go.mod`, el Reporte cae al texto plano sin romperse.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/workspace/ContextReport.tsx src/renderer/workspace/ContextReport.css \
        src/i18n/locales/en.ts src/i18n/locales/es.ts
git commit -m "Pinta el contexto deps como dependencias y scripts"
```

---

## Fuera de este plan

Recogido del spec, para no ampliarlo por el camino:

- Editar las notas de un contexto de proyecto (necesita un canal IPC nuevo que reescriba sólo la parte humana de `iaterminal:notes`).
- Persistir el plegado del árbol entre aperturas del modal.
- Vistas ricas para `git`, `symbols` y `files`: caen en el cuerpo genérico.
- Unificar `ANNOTATION_RE` con la copia de `electron/tabContextBuild.ts`.
