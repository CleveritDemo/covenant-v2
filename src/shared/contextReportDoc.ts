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
