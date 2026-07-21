export type TabContextKind =
  | 'folderTree'
  | 'files'
  | 'symbols'
  | 'notes'
  | 'git'
  | 'deps'
  | 'readme'
  | 'changelog'
  | 'agentResult'

/** Kinds que el host materializa solo; no hay contextos de mantenimiento humano. */
export const HOST_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'git', 'deps', 'readme', 'changelog',
] as const

/** Markdown libre del usuario o resultados de agente; se adjunta entero (sin catálogo / need-sections). */
export const CUSTOM_CONTEXT_KINDS: readonly TabContextKind[] = ['notes', 'agentResult'] as const

/** Kinds que el usuario puede crear desde el gestor (no incluye resultados de agente). */
export const CREATABLE_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog',
] as const

/** Todos los kinds válidos en disco / UI (host + personalizados). */
export const ALL_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog', 'agentResult',
] as const

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
  /** Ícono visual (allowlist); si falta, se deriva del kind. */
  icon?: string
  /** Color hex `#rrggbb` (allowlist); si falta, se deriva del kind. */
  color?: string
  rootPath?: string
  paths?: string[]
  symbolKinds?: TabContextSymbolKind[]
}

export function isAgentResultContext(context: Pick<TabContext, 'kind'>): boolean {
  return context.kind === 'agentResult'
}

export function isProjectContext(context: Pick<TabContext, 'kind'>): boolean {
  return context.kind !== 'agentResult'
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

/**
 * Claves anotables del bloque auto.
 * Soporta formato compacto de symbols (`### path` + `- Class: m1, m2`) y backticks legacy.
 */
export function collectAutoAnnotationKeys(auto: string): Set<string> {
  const keys = new Set<string>()
  for (const match of auto.matchAll(/`([^`\n]+)`/g)) keys.add(match[1])

  let currentPath = ''
  for (const line of auto.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (heading) {
      currentPath = heading[2].trim()
      continue
    }
    if (!currentPath) continue
    const trimmed = line.trim()
    const withMethods = /^- ([A-Za-z_$][\w$]*):\s*(.*)$/.exec(trimmed)
    if (withMethods) {
      const className = withMethods[1]
      keys.add(`${currentPath}#class:${className}`)
      for (const part of withMethods[2].split(',')) {
        const method = part.trim()
        if (method) keys.add(`${currentPath}#method:${className}.${method}`)
      }
      continue
    }
    const bare = /^- ([A-Za-z_$][\w$]*)$/.exec(trimmed)
    if (bare) keys.add(`${currentPath}#method:${bare[1]}`)
  }
  return keys
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
        HOST_CONTEXT_KINDS.includes(value.kind as TabContextKind)
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
            .slice(0, 20)
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
  if (context.kind === 'agentResult') return false
  if (context.kind === 'git') return true

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

/**
 * Selección inicial: mapa + todos los índices de símbolos (materializados por el host).
 * Excluye deps/changelog/readme/git hasta que el usuario los active.
 */
export function defaultAssignedContextIds(contexts: readonly TabContext[]): string[] {
  if (!contexts.length) return []
  const selected: string[] = []
  const push = (id: string | undefined): void => {
    if (!id || selected.includes(id)) return
    selected.push(id)
  }

  push(contexts.find(context => context.kind === 'folderTree')?.id)
  for (const context of contexts) {
    if (context.kind === 'symbols') push(context.id)
  }

  if (selected.length) return selected

  // Fallback: estructura existente; nunca deps/changelog por defecto.
  return contexts
    .filter(context => context.kind === 'folderTree' || context.kind === 'symbols')
    .map(context => context.id)
}

/** Sugiere nombre/archivo para un contexto symbols según la subcarpeta. */
export function suggestSymbolsIdentity(rootPath: string | undefined): {
  name: string
  fileStem: string
} {
  const normalized = (rootPath ?? '').trim().replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/\/+$/, '')
  if (!normalized || normalized === '.') {
    return { name: 'Classes and methods', fileStem: 'classes-methods' }
  }
  const label = normalized.split('/').filter(Boolean).join(' / ')
  const stem = normalized.split('/').filter(Boolean).join('-') || 'classes'
  return {
    name: `Classes · ${label}`,
    fileStem: `classes-${stem}`,
  }
}
