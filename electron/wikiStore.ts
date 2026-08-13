import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'
import { projectDirPath } from './projectDir'
import {
  INDEX_FILE,
  LOG_FILE,
  PAGES_DIR,
  WIKI_DIR,
  buildWikiIndex,
  composeWikiPage,
  formatWikiLogEntry,
  normalizeWikiPageType,
  normalizeWikiSlug,
  parseWikiLinks,
  parseWikiPage,
  type WikiIngest,
  type WikiPage,
} from '../src/shared/wikiDoc'

/** Raíz de la wiki para este cwd: `.gravity/wiki` (o `.iaterminal/wiki` legacy). */
export function wikiRootPath(cwd: string): string {
  return projectDirPath(cwd, WIKI_DIR)
}

/**
 * Ruta absoluta de la page solo si el slug es canónico y la ruta resuelta
 * queda bajo wiki/pages (patrón safeFile de tabContextBuild). Un slug con
 * traversal o segmentos extra devuelve null: nunca se escribe fuera.
 */
function safePagePath(wikiRoot: string, slug: string): string | null {
  if (!slug || slug !== normalizeWikiSlug(slug)) return null
  const pagesRoot = resolve(wikiRoot, PAGES_DIR)
  const candidate = resolve(pagesRoot, `${slug}.md`)
  const rel = relative(pagesRoot, candidate)
  if (rel.startsWith('..') || isAbsolute(rel) || rel.includes('/') || rel.includes('\\')) return null
  return candidate
}

/** Crea pages/, index.md y log.md si faltan; devuelve la raíz de la wiki. */
export function ensureWiki(cwd: string): string {
  const root = wikiRootPath(cwd)
  mkdirSync(join(root, PAGES_DIR), { recursive: true })
  const indexPath = join(root, INDEX_FILE)
  if (!existsSync(indexPath)) writeFileSync(indexPath, buildWikiIndex([]), 'utf8')
  const logPath = join(root, LOG_FILE)
  if (!existsSync(logPath)) writeFileSync(logPath, '# Wiki log\n', 'utf8')
  return root
}

/**
 * Bootstrap desde la UI: asegura el árbol y, SOLO si no hay ninguna page,
 * siembra 'overview' por la misma ruta de escritura que applyWikiIngest
 * (composeWikiPage + index determinista + línea de log con agentId 'human').
 * Con pages existentes no toca nada.
 */
export function ensureWikiWithSeed(cwd: string): WikiIngestResult {
  ensureWiki(cwd)
  if (readWikiPages(cwd).length > 0) return { ok: true, applied: 0, errors: [] }
  return applyWikiIngest(cwd, {
    ops: [{
      op: 'upsert',
      slug: 'overview',
      title: 'Overview',
      type: 'concept',
      body: 'Starting point for this project wiki. Agents will grow it with durable concepts, decisions and flows.',
    }],
    log: 'Wiki created from the map with an initial overview page',
  }, { agentId: 'human' })
}

/** Parsea los *.md de wiki/pages, ordenados por slug. */
export function readWikiPages(cwd: string): WikiPage[] {
  const pagesRoot = join(wikiRootPath(cwd), PAGES_DIR)
  let entries: string[]
  try {
    entries = readdirSync(pagesRoot)
  } catch {
    return []
  }
  const pages: WikiPage[] = []
  for (const entry of entries) {
    if (!/\.md$/i.test(entry)) continue
    let raw: string
    try {
      raw = readFileSync(join(pagesRoot, entry), 'utf8')
    } catch {
      continue
    }
    pages.push(parseWikiPage(raw, entry))
  }
  return pages.sort((a, b) => a.slug.localeCompare(b.slug))
}

export interface WikiIngestResult {
  ok: boolean
  applied: number
  errors: string[]
}

/** Page mínima que viaja del server para el pull org (sin metadatos de auditoría). */
export interface WikiSyncPage {
  slug: string
  title: string
  type: string
  body: string
}

/** Últimas `maxLines` líneas de log.md; [] si no hay wiki o log local. */
export function readWikiLogTail(cwd: string, maxLines = 50): string[] {
  let raw: string
  try {
    raw = readFileSync(join(wikiRootPath(cwd), LOG_FILE), 'utf8')
  } catch {
    return []
  }
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '')
  return lines.slice(-maxLines)
}

/** Entrada del log del server para el pull org (sin ids de auditoría). */
export interface WikiSyncLogEntry {
  entry: string
  createdBy?: string | null
  createdAt?: number
}

/**
 * Pull org: reescribe log.md completo desde el server (DESC → ASC). Con lista
 * vacía y sin wiki local previa no crea nada (misma semántica que pages).
 */
export function replaceWikiLogFromServer(
  cwd: string,
  entries: readonly WikiSyncLogEntry[],
): WikiIngestResult {
  if (entries.length === 0 && !existsSync(wikiRootPath(cwd))) {
    return { ok: true, applied: 0, errors: [] }
  }
  const root = ensureWiki(cwd)
  const ascending = [...entries].reverse()
  const lines: string[] = []
  for (const item of ascending) {
    const summary = typeof item.entry === 'string' ? item.entry : ''
    if (!summary.trim()) continue
    const timestampIso = item.createdAt != null
      ? new Date(item.createdAt).toISOString()
      : new Date().toISOString()
    const createdBy = item.createdBy ?? undefined
    lines.push(formatWikiLogEntry({
      timestampIso,
      agentId: createdBy,
      summary,
    }))
  }
  writeFileSync(
    join(root, LOG_FILE),
    `# Wiki log\n${lines.length ? `${lines.join('\n')}\n` : ''}`,
    'utf8',
  )
  return { ok: true, applied: lines.length, errors: [] }
}

/**
 * Pull org: escribe cada page del server, ELIMINA las locales fuera del set y
 * regenera index.md. Nunca toca log.md. Con lista vacía y sin wiki local
 * previa no crea nada (no materializar wikis vacías).
 */
export function replaceWikiPagesFromServer(
  cwd: string,
  pages: readonly WikiSyncPage[],
): WikiIngestResult {
  if (pages.length === 0 && !existsSync(wikiRootPath(cwd))) {
    return { ok: true, applied: 0, errors: [] }
  }
  const root = ensureWiki(cwd)
  const errors: string[] = []
  let applied = 0
  const keep = new Set<string>()
  for (const page of pages) {
    const slug = normalizeWikiSlug(page.slug)
    const path = safePagePath(root, slug)
    if (!path) {
      errors.push(`invalid slug: ${page.slug}`)
      continue
    }
    keep.add(slug)
    try {
      writeFileSync(path, composeWikiPage({
        slug,
        title: page.title,
        type: normalizeWikiPageType(page.type),
        body: page.body,
        links: parseWikiLinks(page.body, slug),
      }), 'utf8')
      applied += 1
    } catch (error) {
      errors.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const pagesRoot = join(root, PAGES_DIR)
  let entries: string[] = []
  try {
    entries = readdirSync(pagesRoot)
  } catch { /* sin pages dir: nada que borrar */ }
  for (const entry of entries) {
    if (!/\.md$/i.test(entry)) continue
    const slug = normalizeWikiSlug(entry)
    if (keep.has(slug)) continue
    try {
      rmSync(join(pagesRoot, entry))
      applied += 1
    } catch (error) {
      errors.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  writeFileSync(join(root, INDEX_FILE), buildWikiIndex(readWikiPages(cwd)), 'utf8')
  return { ok: errors.length === 0, applied, errors }
}

/**
 * Aplica upserts/deletes del fence, regenera index.md desde disco y appendea
 * la línea de log. Los slugs inválidos suman error y no tocan disco.
 */
export function applyWikiIngest(
  cwd: string,
  ingest: WikiIngest,
  options: { agentId?: string } = {},
): WikiIngestResult {
  const root = ensureWiki(cwd)
  const errors: string[] = []
  let applied = 0
  for (const op of ingest.ops) {
    const path = safePagePath(root, op.slug)
    if (!path) {
      errors.push(`invalid slug: ${op.slug}`)
      continue
    }
    try {
      if (op.op === 'upsert') {
        writeFileSync(path, composeWikiPage({
          slug: op.slug,
          title: op.title,
          type: op.type,
          body: op.body,
          links: parseWikiLinks(op.body, op.slug),
        }), 'utf8')
        applied += 1
      } else if (existsSync(path)) {
        rmSync(path)
        applied += 1
      }
    } catch (error) {
      errors.push(`${op.slug}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  writeFileSync(join(root, INDEX_FILE), buildWikiIndex(readWikiPages(cwd)), 'utf8')
  if (applied > 0 || ingest.log) {
    const summary = ingest.log ?? `${applied} wiki change${applied === 1 ? '' : 's'}`
    const line = formatWikiLogEntry({
      timestampIso: new Date().toISOString(),
      agentId: options.agentId,
      summary,
    })
    appendFileSync(join(root, LOG_FILE), `${line}\n`, 'utf8')
  }
  return { ok: errors.length === 0, applied, errors }
}
