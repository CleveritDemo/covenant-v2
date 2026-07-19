import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { extname, join, resolve } from 'path'
import { normalizeContextFileName } from '../src/shared/tabContext'

export const DEFAULT_CHANGELOG_FILE = 'changelog.md'
const CHANGELOG_FENCE_RE = /```ia-terminal-changelog\s*\n([\s\S]*?)\n```/g
const ENTRY_RE = /^-\s+`([^`]+)`\s+—(?:\s+`([^`]+)`\s+—)?\s+(.+)$/gm
const CONTEXT_META_LINE_RE = /^<!--\s*iaterminal:context\s+(\{[^\n]*\})\s*-->\s*$/m
const MAX_CHANGES = 10
const MAX_WORDS = 30
const CHANGELOG_BLURB = '> Últimos 10 cambios realizados por la IA. Generado automáticamente.'

export interface AiChangelogEntry {
  timestamp: string
  path?: string
  description: string
}

export interface AiReportedChange {
  path: string
  description: string
}

function normalizeDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const words = value
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS)
  return words.length ? words.join(' ') : null
}

function normalizePath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const path = value.trim().replace(/\\/g, '/').replace(/^\.\/+/, '')
  if (!path || path.startsWith('/') || path.split('/').includes('..')) return null
  return path
}

export function extractAiChangelog(text: string, changedPaths: readonly string[]): {
  visibleText: string
  changes: AiReportedChange[]
} {
  const allowedPaths = new Set(
    changedPaths.map(normalizePath).filter((path): path is string => path !== null),
  )
  const changes: AiReportedChange[] = []
  const visibleText = text.replace(CHANGELOG_FENCE_RE, (_match, json: string) => {
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      if (Array.isArray(value.changes)) {
        changes.push(...value.changes
          .map(item => {
            if (!item || typeof item !== 'object') return null
            const raw = item as Record<string, unknown>
            const path = normalizePath(raw.path)
            const description = normalizeDescription(raw.description)
            return path && description && allowedPaths.has(path)
              ? { path, description }
              : null
          })
          .filter((item): item is AiReportedChange => item !== null)
          .slice(0, MAX_CHANGES))
      }
    } catch { /* bloque inválido: se oculta y no se persiste */ }
    return ''
  }).trimEnd()
  return { visibleText, changes }
}

/** Resuelve el Markdown de changelog del workspace (por metadatos o fallback legacy). */
export function resolveAiChangelogPath(
  cwd: string,
  preferredFileName?: string,
): string {
  const directory = join(resolve(cwd), '.iaterminal')
  if (preferredFileName?.trim()) {
    return join(directory, normalizeContextFileName(preferredFileName, 'changelog'))
  }
  try {
    if (existsSync(directory)) {
      for (const entry of readdirSync(directory, { withFileTypes: true })
        .filter(item => item.isFile() && extname(item.name).toLowerCase() === '.md')
        .sort((a, b) => a.name.localeCompare(b.name))) {
        const raw = readFileSync(join(directory, entry.name), 'utf8')
        const meta = raw.match(CONTEXT_META_LINE_RE)?.[1]
        if (meta) {
          try {
            const value = JSON.parse(meta) as Record<string, unknown>
            if (value.kind === 'changelog') return join(directory, entry.name)
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
  return join(directory, DEFAULT_CHANGELOG_FILE)
}

function parseEntries(raw: string): AiChangelogEntry[] {
  return [...raw.matchAll(ENTRY_RE)]
    .map(match => ({
      timestamp: match[1],
      ...(match[2] ? { path: normalizePath(match[2]) ?? undefined } : {}),
      description: normalizeDescription(match[3]) ?? '',
    }))
    .filter(entry => entry.description)
    .slice(0, MAX_CHANGES)
}

export function readAiChangelog(cwd: string, preferredFileName?: string): AiChangelogEntry[] {
  try {
    return parseEntries(readFileSync(resolveAiChangelogPath(cwd, preferredFileName), 'utf8'))
  } catch {
    return []
  }
}

function readChangelogShell(
  cwd: string,
  preferredFileName?: string,
): { name: string; metadataLine?: string; filePath: string } {
  const filePath = resolveAiChangelogPath(cwd, preferredFileName)
  try {
    const raw = readFileSync(filePath, 'utf8')
    const name = raw.match(/^\s*#\s+(.+?)\s*$/m)?.[1]?.trim() || 'AI Changelog'
    const metadataLine = raw.match(CONTEXT_META_LINE_RE)?.[0]?.trim()
    return { name, filePath, ...(metadataLine ? { metadataLine } : {}) }
  } catch {
    return { name: 'AI Changelog', filePath }
  }
}

export function formatAiChangelogDocument(options: {
  name: string
  metadataLine?: string
  entries?: AiChangelogEntry[]
}): string {
  const entries = options.entries ?? []
  return [
    `# ${options.name.trim() || 'AI Changelog'}`,
    ...(options.metadataLine ? [options.metadataLine] : []),
    '',
    CHANGELOG_BLURB,
    '',
    ...entries.map(entry => entry.path
      ? `- \`${entry.timestamp}\` — \`${entry.path}\` — ${entry.description}`
      : `- \`${entry.timestamp}\` — ${entry.description}`),
    '',
  ].join('\n')
}

export function ensureAiChangelog(
  cwd: string,
  options: { name?: string; fileName?: string; metadataLine?: string } = {},
): string {
  const filePath = resolveAiChangelogPath(cwd, options.fileName)
  mkdirSync(join(resolve(cwd), '.iaterminal'), { recursive: true })
  if (!existsSync(filePath)) {
    try {
      writeFileSync(
        filePath,
        formatAiChangelogDocument({
          name: options.name ?? 'AI Changelog',
          metadataLine: options.metadataLine,
        }),
        { encoding: 'utf8', flag: 'wx' },
      )
    } catch {
      // Otro panel pudo crearlo entre existsSync y writeFileSync.
    }
  }
  return filePath
}

export function writeAiChangelogDocument(
  cwd: string,
  options: {
    name: string
    fileName?: string
    metadataLine?: string
    entries?: AiChangelogEntry[]
  },
): string {
  const directory = join(resolve(cwd), '.iaterminal')
  const filePath = resolveAiChangelogPath(cwd, options.fileName)
  const temporaryPath = join(directory, `.${normalizeContextFileName(options.fileName || DEFAULT_CHANGELOG_FILE)}.tmp`)
  const content = formatAiChangelogDocument({
    name: options.name,
    metadataLine: options.metadataLine,
    entries: options.entries ?? readAiChangelog(cwd, options.fileName),
  })
  mkdirSync(directory, { recursive: true })
  writeFileSync(temporaryPath, content, 'utf8')
  renameSync(temporaryPath, filePath)
  return filePath
}

export function appendAiChangelog(
  cwd: string,
  changes: AiReportedChange[],
  timestamp = new Date().toISOString(),
): AiChangelogEntry[] {
  const normalized = changes
    .map(change => {
      const path = normalizePath(change.path)
      const description = normalizeDescription(change.description)
      return path && description ? { path, description } : null
    })
    .filter((item): item is AiReportedChange => item !== null)
  const shell = readChangelogShell(cwd)
  // El runtime nunca crea el contexto implícitamente: solo escribe si el
  // usuario ya creó un Markdown de kind=changelog desde el gestor.
  if (!normalized.length || !existsSync(shell.filePath)) return readAiChangelog(cwd)
  const entries = [
    ...normalized.map(change => ({ timestamp, ...change })),
    ...readAiChangelog(cwd),
  ].slice(0, MAX_CHANGES)
  writeAiChangelogDocument(cwd, {
    name: shell.name,
    fileName: shell.filePath.split(/[/\\]/).at(-1),
    metadataLine: shell.metadataLine,
    entries,
  })
  return entries
}

export function buildAiChangelogInstruction(): string {
  return [
    '## AI changelog',
    'After completing the request, report only concrete changes you actually made to files or project configuration.',
    'Every item must identify its exact workspace-relative file path. The host verifies that path against the real before/after filesystem diff and rejects unverified items.',
    'Do not report analysis, commands, tests, unchanged files, or proposed work.',
    'Use at most 10 items and at most 30 words per item. If you made no changes, omit this block.',
    'Append this exact machine-readable block after your normal answer:',
    '```ia-terminal-changelog',
    '{"changes":[{"path":"src/file.ts","description":"Concrete change made"}]}',
    '```',
  ].join('\n')
}
