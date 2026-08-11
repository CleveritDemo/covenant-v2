export type TabContextKind =
  | 'folderTree'
  | 'files'
  | 'symbols'
  | 'notes'
  | 'git'
  | 'deps'
  | 'readme'
  | 'changelog'
  | 'mcp'
  | 'spreadsheet'
  | 'agentResult'
  | 'skill'

/** Kinds que el host materializa solo; no hay contextos de mantenimiento humano. */
export const HOST_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'git', 'deps', 'readme', 'changelog', 'mcp', 'spreadsheet',
] as const

/** Markdown libre del usuario o resultados de agente; se adjunta entero (sin catálogo / need-sections). */
export const CUSTOM_CONTEXT_KINDS: readonly TabContextKind[] = ['notes', 'agentResult'] as const

/** Kinds que el usuario puede crear desde el gestor (no incluye resultados de agente). */
export const CREATABLE_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog', 'mcp', 'spreadsheet',
  'skill',
] as const

/** Todos los kinds válidos en disco / UI (host + personalizados). */
export const ALL_CONTEXT_KINDS: readonly TabContextKind[] = [
  'folderTree', 'files', 'symbols', 'notes', 'git', 'deps', 'readme', 'changelog', 'mcp', 'spreadsheet',
  'agentResult', 'skill',
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

/** Root relativo normalizado para ids canónicos (`.` = proyecto). */
export function normalizeContextRootPath(value: string | null | undefined): string {
  const normalized = (value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '')
  return !normalized || normalized === '.' ? '.' : normalized
}

function rootFileStem(rootPath: string | null | undefined): string {
  const root = normalizeContextRootPath(rootPath)
  if (root === '.') return ''
  return root.split('/').filter(Boolean).join('-')
}

export interface CanonicalContextOptions {
  rootPath?: string
  /** Stem del archivo (sin .md). */
  fileStem?: string
  /** agentId estable del catálogo (no display name). */
  agentId?: string
  name?: string
}

function isCreatableContextKind(kind: TabContextKind): boolean {
  return (CREATABLE_CONTEXT_KINDS as readonly string[]).includes(kind)
}

/** Stem por defecto histórico cuando no hay name/fileStem. */
function defaultCreatableStem(kind: TabContextKind, options: CanonicalContextOptions = {}): string {
  switch (kind) {
    case 'folderTree': {
      const stem = rootFileStem(options.rootPath)
      return stem ? `folders-${stem}` : 'folders'
    }
    case 'files': {
      const stem = rootFileStem(options.rootPath)
      return stem ? `files-${stem}` : 'files'
    }
    case 'symbols':
      return suggestSymbolsIdentity(options.rootPath).fileStem
    case 'deps':
      return 'dependences'
    case 'git':
      return 'git'
    case 'readme':
      return 'readme'
    case 'changelog':
      return 'changelog'
    case 'mcp':
      return 'mcps'
    case 'notes':
      return 'notes'
    case 'skill':
      return 'skill'
    default:
      return kind
  }
}

/** Stem de identidad: name → fileStem → default del kind. */
export function creatableContextStem(
  kind: TabContextKind,
  options: CanonicalContextOptions = {},
): string {
  const fallback = defaultCreatableStem(kind, options)
  return normalizeContextFileName(
    (options.name ?? '').trim() || (options.fileStem ?? '').trim() || fallback,
    fallback,
  ).replace(/\.md$/i, '')
}

/** Id estable en disco / contextIds: `iaterminal:<kind>:<stem>` (creatable). */
export function canonicalContextId(
  kind: TabContextKind,
  options: CanonicalContextOptions = {},
): string {
  if (kind === 'agentResult') {
    const agentId = (options.agentId ?? '').trim() || 'agent'
    return `iaterminal:result:${agentId}`
  }
  if (isCreatableContextKind(kind)) {
    return `iaterminal:${kind}:${creatableContextStem(kind, options)}`
  }
  return `iaterminal:${kind}`
}

/** Ruta relativa bajo `.gravity/` para el kind. */
export function canonicalContextFileName(
  kind: TabContextKind,
  options: CanonicalContextOptions = {},
): string {
  if (kind === 'agentResult') {
    const agentId = (options.agentId ?? '').trim() || 'agent'
    return `results/${agentId}.md`
  }
  if (isCreatableContextKind(kind)) {
    return normalizeContextFileName(
      creatableContextStem(kind, options),
      defaultCreatableStem(kind, options),
    )
  }
  return normalizeContextFileName(kind)
}

/** Nombre visible por defecto del kind. */
export function canonicalContextName(
  kind: TabContextKind,
  options: CanonicalContextOptions = {},
): string {
  const root = normalizeContextRootPath(options.rootPath)
  const label = root === '.' ? '' : root.split('/').filter(Boolean).join(' / ')
  switch (kind) {
    case 'folderTree':
      return label ? `Folders · ${label}` : 'folders'
    case 'files':
      return label ? `Files · ${label}` : 'Files'
    case 'symbols':
      return suggestSymbolsIdentity(options.rootPath).name
    case 'deps':
      return 'Dependencies'
    case 'git':
      return 'Git'
    case 'readme':
      return 'README'
    case 'changelog':
      return 'AI Changelog'
    case 'mcp':
      return 'MCP servers'
    case 'notes':
      return (options.name ?? '').trim() || 'Notes'
    case 'skill':
      return (options.name ?? '').trim() || 'Skill'
    case 'agentResult':
      return (options.name ?? '').trim() || (options.agentId ?? 'agent')
    default:
      return kind
  }
}

/** Firma de definición para deduplicar creatables por kind+stem (mismo archivo). */
export function contextDefinitionKey(context: Pick<TabContext, 'kind' | 'rootPath' | 'paths' | 'symbolKinds' | 'fileName' | 'name' | 'id'>): string | null {
  if (context.kind === 'agentResult') {
    const agentId = context.id.replace(/^iaterminal:result:/, '')
      || context.fileName.replace(/^results\//, '').replace(/\.md$/i, '')
    return JSON.stringify({ kind: 'agentResult', agentId })
  }
  if (!isCreatableContextKind(context.kind)) return null
  const stem = creatableContextStem(context.kind, {
    rootPath: context.rootPath,
    fileStem: context.fileName?.replace(/\.md$/i, ''),
    name: context.name,
  })
  return JSON.stringify({ kind: context.kind, stem })
}

/** Rellena id/fileName/name canónicos; fileName creatable siempre deriva del name. */
export function applyCanonicalContextIdentity(context: TabContext): TabContext {
  const rootPath = context.rootPath
  const fileStem = context.fileName?.replace(/\.md$/i, '')
  const agentId = context.kind === 'agentResult'
    ? (context.id.startsWith('iaterminal:result:')
        ? context.id.slice('iaterminal:result:'.length)
        : (context.fileName?.replace(/^results\//, '').replace(/\.md$/i, '') || undefined))
    : undefined
  // Name vacío → stem desde fileStem/default (no desde el display name canónico).
  const identityName = context.name.trim() || undefined
  const id = canonicalContextId(context.kind, {
    rootPath,
    fileStem,
    agentId,
    name: identityName,
  })
  const fileName = canonicalContextFileName(context.kind, {
    rootPath,
    fileStem,
    agentId,
    name: identityName,
  })
  const resolvedName = context.name.trim()
    || canonicalContextName(context.kind, { rootPath, name: context.name, agentId })
  return {
    ...context,
    id,
    fileName,
    name: resolvedName,
    ...(rootPath !== undefined
      ? { rootPath: normalizeContextRootPath(rootPath) === '.' ? undefined : normalizeContextRootPath(rootPath) }
      : {}),
  }
}

/** ¿El id ya es canónico para su kind? (ids cortos legacy → false, se migran). */
export function isCanonicalContextId(context: Pick<TabContext, 'id' | 'kind' | 'rootPath' | 'fileName' | 'name'>): boolean {
  if (context.kind === 'agentResult') {
    // agentId = stem de results/<agentId>.md (no el display name ni un id suelto).
    const stem = (context.fileName ?? '')
      .replace(/\\/g, '/')
      .replace(/^results\//i, '')
      .replace(/\.md$/i, '')
      .trim()
    const agentId = stem || undefined
    if (!agentId) return false
    return context.id === canonicalContextId('agentResult', { agentId })
  }
  const expected = canonicalContextId(context.kind, {
    rootPath: context.rootPath,
    fileStem: context.fileName?.replace(/\.md$/i, ''),
    name: context.name,
  })
  return context.id === expected
}

/** Definición persistida; el contenido vivo se materializa desde el disco. */
export interface TabContext {
  id: string
  name: string
  /** Nombre del archivo materializado dentro de `<cwd>/.gravity/`. */
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

export function isProjectContext(context: Pick<TabContext, 'kind'>): boolean {
  return context.kind !== 'agentResult'
}

export interface TabContextPreviewRequest {
  context: TabContext
  cwd: string
  /** Solo para notes al guardar; nunca se persiste en session.json. */
  content?: string
  /** Archivo previo al renombrar en edit; se elimina tras escribir el nuevo. */
  previousFileName?: string
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
  /** oldId → canonicalId cuando se migró metadata en disco. */
  idRemap?: Record<string, string>
  /** true si algún id/archivo se normalizó a canónico. */
  contextsMigrated?: boolean
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
  if (context.kind === 'mcp') {
    return underRoot.some(path => path.split('/').at(-1) === '.mcp.json')
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

/**
 * ¿La ruta se queda dentro del proyecto? El host recorta en silencio cualquier
 * raíz que se escape (`safeRoot` en tabContextBuild), así que la UI necesita
 * poder avisarlo antes de guardar en vez de dejar que el contexto salga vacío.
 */
export function isProjectRelativePath(value: string): boolean {
  const path = value.trim()
  if (!path) return true
  if (path.startsWith('/') || path.startsWith('\\') || /^[A-Za-z]:[\\/]/.test(path)) return false
  return !path.split(/[\\/]+/).includes('..')
}
