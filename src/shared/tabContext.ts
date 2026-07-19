export type TabContextKind =
  | 'folderTree'
  | 'files'
  | 'symbols'
  | 'notes'
  | 'git'
  | 'deps'
  | 'readme'
  | 'changelog'

export type TabContextSymbolKind = 'class' | 'method' | 'variable'

export function normalizeContextFileName(value: string | null | undefined, fallback = 'context'): string {
  const stem = (value ?? '')
    .trim()
    .replace(/\.md$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80) || fallback
  return `${stem}.md`
}

/** Definición persistida; el contenido vivo se materializa desde el disco. */
export interface TabContext {
  id: string
  name: string
  /** Nombre del archivo materializado dentro de `<cwd>/.iaterminal/`. */
  fileName: string
  kind: TabContextKind
  rootPath?: string
  paths?: string[]
  symbolKinds?: TabContextSymbolKind[]
}

export interface TabContextPreviewRequest {
  context: TabContext
  cwd: string
  /** Solo para notes al guardar; nunca se persiste en session.json. */
  content?: string
}

export interface TabContextPreviewResult {
  ok: boolean
  content: string
  /** Contenido durable sin los marcadores; útil para editar contexts notes. */
  notesContent?: string
  filePath?: string
  error?: string
}

export interface TabContextDiscoveryRequest {
  cwd: string
}

export interface TabContextDiscoveryResult {
  ok: boolean
  contexts: TabContext[]
  error?: string
}

export interface TabContextDeleteRequest {
  context: TabContext
  cwd: string
}

export interface TabContextDeleteResult {
  ok: boolean
  error?: string
}

export interface TabContextAnnotation {
  key: string
  text: string
}

export interface TabContextAnnotationRequest {
  context: TabContext
  cwd: string
  annotations: TabContextAnnotation[]
}

const UPDATE_FENCE_RE = /```ia-terminal-context\s*\n([\s\S]*?)\n```/g

export interface TabContextUpdate {
  id: string
  kind: TabContextKind
  body?: string
  paths?: string[]
  annotations?: TabContextAnnotation[]
}

export function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export function normalizeAnnotation(value: unknown): TabContextAnnotation | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.key !== 'string' || typeof raw.text !== 'string') return null
  const key = raw.key.trim().slice(0, 300)
  const words = raw.text.trim().split(/\s+/).filter(Boolean).slice(0, 10)
  if (!key || !words.length) return null
  return { key, text: words.join(' ') }
}

/** Extrae actualizaciones estructuradas y devuelve texto limpio para el chat. */
export function extractTabContextUpdates(text: string): {
  visibleText: string
  updates: TabContextUpdate[]
} {
  const updates: TabContextUpdate[] = []
  const visibleText = text.replace(UPDATE_FENCE_RE, (_match, json: string) => {
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      if (
        typeof value.id === 'string' &&
        typeof value.kind === 'string' &&
        ['folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog'].includes(value.kind)
      ) {
        const update: TabContextUpdate = {
          id: value.id,
          kind: value.kind as TabContextKind,
        }
        if (typeof value.body === 'string') update.body = value.body
        if (Array.isArray(value.paths)) {
          update.paths = value.paths
            .filter((item): item is string => typeof item === 'string')
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, 200)
        }
        if (Array.isArray(value.annotations)) {
          update.annotations = value.annotations
            .map(normalizeAnnotation)
            .filter((item): item is TabContextAnnotation => item !== null)
            .slice(0, 500)
        }
        updates.push(update)
      }
    } catch { /* fence inválido: se oculta, pero no se aplica */ }
    return ''
  }).trimEnd()
  return { visibleText, updates }
}

function normalizedRelativePath(value: string): string {
  return value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '')
}

function rootedContextPath(context: TabContext, value: string): string {
  const root = normalizedRelativePath(context.rootPath ?? '')
  const path = normalizedRelativePath(value)
  if (!root || root === '.') return path
  // Las claves de símbolos/archivos ya se generan con el rootPath incluido
  // (displayPath). Reanteponerlo produciría `src/src/...` y nunca casaría
  // con el diff real. Solo se antepone cuando la clave es relativa al root.
  if (path === root || path.startsWith(`${root}/`)) return path
  return [root, path].filter(part => part && part !== '.').join('/')
}

function annotationHasChangedEvidence(
  context: TabContext,
  key: string,
  changedPaths: Set<string>,
): boolean {
  if (!changedPaths.size) return false
  if (context.kind === 'changelog') return false
  if (context.kind === 'notes' || context.kind === 'git') return true

  const root = normalizedRelativePath(context.rootPath ?? '')
  const underRoot = [...changedPaths].filter(path =>
    !root || root === '.' || path === root || path.startsWith(`${root}/`))
  if (context.kind === 'deps') {
    const manifests = new Set([
      'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
      'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'Cargo.lock',
      'go.mod', 'go.sum', 'pom.xml', 'build.gradle',
    ])
    return underRoot.some(path => manifests.has(path.split('/').at(-1) ?? ''))
  }
  if (context.kind === 'readme') {
    return underRoot.some(path => /^readme(?:\.[^/]*)?$/i.test(path.split('/').at(-1) ?? ''))
  }

  const keyPath = rootedContextPath(context, key.split('#')[0])
  if (!keyPath) return false
  if (context.kind === 'folderTree') {
    return [...changedPaths].some(path =>
      path === keyPath || path.startsWith(`${keyPath}/`) || keyPath.startsWith(`${path}/`))
  }
  return changedPaths.has(keyPath)
}

/**
 * Conserva únicamente anotaciones respaldadas por el diff real del turno.
 * Los bloques sin evidencia se eliminan antes de llegar al renderer.
 */
export function filterTabContextUpdatesByChangedPaths(
  text: string,
  changedPaths: readonly string[],
  contexts: readonly TabContext[],
): string {
  const changed = new Set(changedPaths.map(normalizedRelativePath).filter(Boolean))
  const byId = new Map(contexts.map(context => [context.id, context]))
  return text.replace(UPDATE_FENCE_RE, (_match, json: string) => {
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      if (typeof value.id !== 'string' || typeof value.kind !== 'string') return ''
      const context = byId.get(value.id)
      if (!context || context.kind !== value.kind || !Array.isArray(value.annotations)) return ''
      const annotations = value.annotations
        .map(normalizeAnnotation)
        .filter((item): item is TabContextAnnotation =>
          item !== null && annotationHasChangedEvidence(context, item.key, changed))
      if (!annotations.length) return ''
      return [
        '```ia-terminal-context',
        JSON.stringify({ id: context.id, kind: context.kind, annotations }),
        '```',
      ].join('\n')
    } catch {
      return ''
    }
  })
}
