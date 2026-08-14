/**
 * Modelo puro de la wiki del proyecto (`.gravity/wiki`): slugs, pages,
 * índice, log y fence de ingest. Sin fs — el store en electron/wikiStore.ts
 * es quien toca disco.
 */

/** Carpeta de la wiki, relativa a la carpeta del proyecto (`.gravity`). */
export const WIKI_DIR = 'wiki'
export const PAGES_DIR = 'pages'
export const INDEX_FILE = 'index.md'
export const LOG_FILE = 'log.md'

export const WIKI_PAGE_TYPES = ['concept', 'decision', 'flow', 'reference'] as const
export type WikiPageType = (typeof WIKI_PAGE_TYPES)[number]

export const MAX_WIKI_INGEST_OPS = 8
/** Cap de ingest solo para /init del curador wiki (≥20 nodos + margen deletes). */
export const MAX_WIKI_INIT_INGEST_OPS = 24
export const MAX_WIKI_PAGE_BODY = 10000
export const MAX_WIKI_PAGE_TITLE = 120
export const MAX_WIKI_LOG_SUMMARY = 200

/**
 * Política de escritura de wiki compartida por agentes (ingest) y curador.
 * Un solo texto para ambos callers.
 */
export function buildWikiWritingGuidance(): string {
  return [
    'Only durable project knowledge. If nothing durable changed, skip.',
    'If new knowledge contradicts an existing page, do not overwrite silently: fix the stale claim and mention the contradiction in the log line, or add a "Contradicts: [[slug]] — why" note in the body when unresolved.',
    'The wiki is an index for agents (humans are secondary): many short nodes, dense with [[slug]] links and real file paths. Scarcity of nodes is a failure; long prose without paths is also a failure.',
    'Each page does ONE job:',
    '- narrate (concept): why it exists — product intent, local vs org, orchestration.',
    '- locate (concept|reference): feature → files (e.g. layer-*, create-*, *-ui). Without paths, locate pages are useless.',
    '- decide (decision): a rule agents must follow.',
    '- flow (flow): who calls whom and when it ends.',
    '- inventory (reference): stable lists (kinds, providers, fences, live bugs).',
    'No transcripts, no per-symbol file:line dumps — say which file to open. Covering the system may take several turns (≤8 ops/turn).',
    'Good body examples (put these as plain lines, then one fence example below in callers):',
    '- concept/narrate: "Center of command: human says what/why; agents do how. Local = one folder; org = ready environment. See [[agentic-plane]] [[workspace-logic]]."',
    '- locate: "Agent create: AgentProviderPickerModal.tsx → App.tsx handleAddAgentPane → projectAgentCatalogOps.ts → .gravity/agents/<slug>.json. See [[create-agent]] [[agent-identity]]."',
    '- decision: "UI via typed props only — never className/style on kit components. If look does not fit, new component. Gate: check:ui. See [[ui-kit-contract]]."',
    '- flow: "Fence ia-terminal-delegate parsed in aiAgentDelegate.ts; App.tsx dispatches; jobs live in orchestrationJobs refs (reload loses them). See [[delegation-mechanics]]."',
    '- inventory: "14 context kinds in tabContext.ts ALL_CONTEXT_KINDS including jira and wiki. Direct bodies: notes, agentResult. See [[context-kinds]]."',
    'Bad (do not write): a 20-line essay with no [[links]] and no file paths; dumping a whole feature checklist into one page.',
    'Link related pages with [[slug]] in every body.',
  ].join('\n')
}

const WIKI_INDEX_EXCERPT_MAX = 120

/**
 * Mismo criterio que normalizeContextFileName (src/shared/tabContext.ts) pero
 * en minúsculas y sin extensión: NFKD, sin diacríticos, todo lo no permitido
 * pasa a '-', recorta `.`/`-` en los extremos y corta a 80.
 */
export function normalizeWikiSlug(value: string | null | undefined, fallback = 'page'): string {
  const stem = (value ?? '')
    .trim()
    .replace(/\.md$/i, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80)
    .toLowerCase()
  return stem || fallback
}

export function normalizeWikiPageType(value: unknown): WikiPageType {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return (WIKI_PAGE_TYPES as readonly string[]).includes(raw)
    ? (raw as WikiPageType)
    : 'concept'
}

export interface WikiPage {
  slug: string
  title: string
  type: WikiPageType
  body: string
  /** Slugs referenciados desde el body; derivados, no se guardan aparte. */
  links: string[]
  /** mtime del .md en disco; solo lo rellena readWikiPages (electron). */
  updatedAtMs?: number
}

const WIKI_PAGE_META_RE = /<!--\s*iaterminal:wiki-page\s+(\{[^\n]*\})\s*-->/
const WIKILINK_RE = /\[\[([^\[\]\n]+)\]\]/g
// Solo links relativos a pages: `](slug.md)` o `](pages/slug.md)`. Excluir
// `/` y `:` del slug deja fuera URLs absolutas y rutas anidadas.
const MD_LINK_RE = /\]\((?:\.\/)?(?:pages\/)?([^)/\s:]+)\.md\)/g

function serializeWikiPageMetadata(type: WikiPageType): string {
  const metadata = JSON.stringify({ type })
    // Evita que datos proporcionados por el usuario puedan cerrar el comentario.
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
  return `<!-- iaterminal:wiki-page ${metadata} -->`
}

/** Wikilinks `[[slug]]` y links md relativos, normalizados, sin duplicados ni self. */
export function parseWikiLinks(body: string, selfSlug?: string): string[] {
  const self = selfSlug ? normalizeWikiSlug(selfSlug) : null
  const links: string[] = []
  const seen = new Set<string>()
  const push = (raw: string): void => {
    const slug = normalizeWikiSlug(raw)
    if (!slug || slug === self || seen.has(slug)) return
    seen.add(slug)
    links.push(slug)
  }
  for (const match of body.matchAll(WIKILINK_RE)) push(match[1])
  for (const match of body.matchAll(MD_LINK_RE)) push(match[1])
  return links
}

/** Línea 1 `# título`, línea 2 comentario de metadata, luego el body. */
export function composeWikiPage(page: WikiPage): string {
  const title = page.title.trim().slice(0, MAX_WIKI_PAGE_TITLE) || page.slug
  const body = page.body.replace(/\r\n/g, '\n').trim()
  return `# ${title}\n${serializeWikiPageMetadata(page.type)}\n\n${body}\n`
}

/** Inverso de composeWikiPage; tolera pages sin heading o sin metadata. */
export function parseWikiPage(raw: string, slug: string): WikiPage {
  const normalizedSlug = normalizeWikiSlug(slug)
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  let title = normalizedSlug
  let start = 0
  const first = (lines[0] ?? '').trim()
  if (first.startsWith('# ')) {
    title = first.slice(2).trim() || normalizedSlug
    start = 1
  }
  let type: WikiPageType = 'concept'
  let rest = lines.slice(start).join('\n')
  const metaMatch = WIKI_PAGE_META_RE.exec(rest)
  if (metaMatch) {
    try {
      type = normalizeWikiPageType((JSON.parse(metaMatch[1]) as { type?: unknown }).type)
    } catch { /* metadata inválida: queda el default */ }
    rest = rest.replace(metaMatch[0], '')
  }
  const body = rest.trim()
  return { slug: normalizedSlug, title, type, body, links: parseWikiLinks(body, normalizedSlug) }
}

function wikiPageExcerpt(body: string): string {
  for (const line of body.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('<!--')) continue
    return trimmed.slice(0, WIKI_INDEX_EXCERPT_MAX)
  }
  return ''
}

/** Índice compacto para prompt: una línea por page con excerpt opcional. */
export function buildWikiPromptIndex(pages: readonly WikiPage[]): string {
  if (!pages.length) return ''
  const bySlug = new Map<string, WikiPage>()
  for (const page of pages) bySlug.set(page.slug, page)
  return [...bySlug.values()]
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(page => {
      const base = `- [[${page.slug}]] — ${page.title} (${page.type})`
      const excerpt = wikiPageExcerpt(page.body)
      return excerpt ? `${base} — ${excerpt}` : base
    })
    .join('\n')
}

/** Índice determinista: pages ordenadas por slug, una entrada por slug. */
export function buildWikiIndex(pages: readonly WikiPage[]): string {
  const bySlug = new Map<string, WikiPage>()
  for (const page of pages) bySlug.set(page.slug, page)
  const sorted = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))
  const lines = ['# Wiki index']
  if (sorted.length) lines.push('')
  for (const page of sorted) {
    let entry = `- [[${page.slug}]] — ${page.title} (${page.type})`
    if (page.links.length) entry += ` → links: ${page.links.join(', ')}`
    lines.push(entry)
    const excerpt = wikiPageExcerpt(page.body)
    if (excerpt) lines.push(`  ${excerpt}`)
  }
  return `${lines.join('\n')}\n`
}

function sanitizeWikiLogSummary(value: string): string {
  return value
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_WIKI_LOG_SUMMARY)
}

export interface WikiLogEntryInput {
  timestampIso: string
  agentId?: string
  summary: string
}

/** Una línea de log: '- `ISO` — [agentId] summary'. */
export function formatWikiLogEntry(input: WikiLogEntryInput): string {
  const summary = sanitizeWikiLogSummary(input.summary)
  const agent = input.agentId?.trim()
  return agent
    ? `- \`${input.timestampIso}\` — [${agent}] ${summary}`
    : `- \`${input.timestampIso}\` — ${summary}`
}

export type WikiIngestOp =
  | { op: 'upsert'; slug: string; title: string; type: WikiPageType; body: string }
  | { op: 'delete'; slug: string }

export interface WikiIngest {
  ops: WikiIngestOp[]
  log: string | null
}

const WIKI_FENCE_RE = /```ia-terminal-wiki\s*\n([\s\S]*?)\n```/g

function normalizeWikiIngestOp(value: unknown): WikiIngestOp | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.slug !== 'string' || !raw.slug.trim()) return null
  const slug = normalizeWikiSlug(raw.slug)
  if (raw.op === 'delete') return { op: 'delete', slug }
  if (raw.op !== 'upsert') return null
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null
  if (typeof raw.body !== 'string') return null
  return {
    op: 'upsert',
    slug,
    title: raw.title.trim().slice(0, MAX_WIKI_PAGE_TITLE),
    type: normalizeWikiPageType(raw.type),
    body: raw.body.slice(0, MAX_WIKI_PAGE_BODY),
  }
}

/**
 * Extrae los fences ```ia-terminal-wiki``` y devuelve el texto limpio para el
 * chat. Mismo patrón que extractTabContextUpdates: JSON inválido → el fence se
 * oculta igual, pero no aplica nada. Caps: maxOps por turno (default 8; init 24),
 */
export function extractWikiIngest(
  text: string,
  maxOps = MAX_WIKI_INGEST_OPS,
): {
  visibleText: string
  ingest: WikiIngest | null
} {
  const ops: WikiIngestOp[] = []
  let log: string | null = null
  const visibleText = text.replace(WIKI_FENCE_RE, (_match, json: string) => {
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      if (Array.isArray(value.ops)) {
        for (const raw of value.ops) {
          if (ops.length >= maxOps) break
          const op = normalizeWikiIngestOp(raw)
          if (op) ops.push(op)
        }
      }
      if (typeof value.log === 'string') {
        const line = sanitizeWikiLogSummary(value.log)
        if (line) log = line
      }
    } catch { /* fence inválido: se oculta, pero no se aplica */ }
    return ''
  }).trimEnd()
  return { visibleText, ingest: ops.length || log !== null ? { ops, log } : null }
}
