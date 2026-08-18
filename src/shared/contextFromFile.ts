import {
  applyCanonicalContextIdentity,
  normalizeContextFileName,
  type TabContext,
} from './tabContext'
import { defaultColorForKind, defaultIconForKind } from './tabContextAppearance'

export function singleFileContextName(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? normalized
}

/** Vista «Un archivo» del kind `files`: referencia viva, sin raíz y una sola ruta. */
export function isSingleFileDraft(
  context: Pick<TabContext, 'kind' | 'paths' | 'rootPath' | 'referenceOnly'>,
): boolean {
  if (context.kind !== 'files') return false
  if (context.referenceOnly !== true) return false
  if (context.rootPath?.trim()) return false
  return normalizePaths(context.paths).length === 1
}

export interface PickedFileContextPlan {
  created: TabContext[]
  skipped: Array<{ path: string; contextId: string }>
}

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/')
}

function normalizeNameKey(name: string): string {
  return name.trim().normalize('NFKC').toLocaleLowerCase()
}

function normalizePaths(paths: string[] | undefined): string[] {
  return (paths ?? []).map(path => path.trim()).filter(Boolean)
}

function isExistingSingleFileContext(context: TabContext, route: string): boolean {
  if (context.kind !== 'files') return false
  if (context.rootPath?.trim()) return false
  const paths = normalizePaths(context.paths).map(normalizePath)
  return paths.length === 1 && paths[0] === route
}

function* iterateNameCandidates(path: string): Generator<string> {
  const normalized = normalizePath(path)
  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) return

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    yield segments.slice(index).join('/')
  }

  const basename = segments[segments.length - 1]
  let suffix = 2
  while (true) {
    yield `${basename} (${suffix})`
    suffix += 1
  }
}

function buildFileContext(name: string, route: string): TabContext {
  return applyCanonicalContextIdentity({
    id: '',
    name,
    fileName: normalizeContextFileName(name),
    kind: 'files',
    paths: [route],
    referenceOnly: true,
    icon: defaultIconForKind('files'),
    color: defaultColorForKind('files'),
  })
}

function resolveUniqueContext(
  path: string,
  existing: TabContext[],
  takenNameKeys: Set<string>,
  takenIds: Set<string>,
): TabContext | null {
  const route = normalizePath(path)
  for (const name of iterateNameCandidates(path)) {
    const nameKey = normalizeNameKey(name)
    if (takenNameKeys.has(nameKey)) continue

    const context = buildFileContext(name, route)
    if (takenIds.has(context.id)) continue
    if (existing.some(item => item.id === context.id)) continue

    takenNameKeys.add(nameKey)
    takenIds.add(context.id)
    return context
  }
  return null
}

export function planContextsFromFiles(
  paths: string[],
  existing: TabContext[],
): PickedFileContextPlan {
  const seen = new Set<string>()
  const normalizedPaths: string[] = []
  for (const raw of paths) {
    const route = normalizePath(raw)
    if (!route || seen.has(route)) continue
    seen.add(route)
    normalizedPaths.push(route)
  }

  const created: TabContext[] = []
  const skipped: PickedFileContextPlan['skipped'] = []
  const takenNameKeys = new Set(existing.map(context => normalizeNameKey(context.name)))
  const takenIds = new Set(existing.map(context => context.id))

  for (const route of normalizedPaths) {
    const match = existing.find(context => isExistingSingleFileContext(context, route))
    if (match) {
      skipped.push({ path: route, contextId: match.id })
      continue
    }

    const context = resolveUniqueContext(route, existing, takenNameKeys, takenIds)
    if (!context) continue
    created.push(context)
  }

  return { created, skipped }
}
