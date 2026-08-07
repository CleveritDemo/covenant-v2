/**
 * Parseo puro del Markdown de un contexto para la vista Reporte.
 * El formato canónico lo escribe `electron/tabContextBuild.ts`; aquí solo se lee.
 */

import type { TabContextKind } from './tabContext'

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
