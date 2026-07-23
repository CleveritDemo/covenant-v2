import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { normalizeContextFileName } from '../src/shared/tabContext'

export const AGENT_RESULTS_DIR = 'results'
const RESULTS_FENCE_RE = /```ia-terminal-results\s*\n([\s\S]*?)\n```/g
const LOG_ENTRY_RE = /^-\s+`([^`]+)`\s+—\s+(.+)$/gm
const MAX_LOG_ENTRIES = 30
const MAX_WORDS = 40

export interface AiAgentResultPayload {
  summary: string
  entries: string[]
}

export interface AiAgentResultLogEntry {
  timestamp: string
  text: string
}

function normalizeText(value: unknown, maxWords = MAX_WORDS): string | null {
  if (typeof value !== 'string') return null
  const words = value
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
  return words.length ? words.join(' ') : null
}

export function agentResultSlug(agentName: string): string {
  return normalizeContextFileName(agentName, 'agent').replace(/\.md$/i, '')
}

export function agentResultFileName(agentName: string): string {
  return `${AGENT_RESULTS_DIR}/${agentResultSlug(agentName)}.md`
}

export function agentResultContextId(agentName: string): string {
  return `iaterminal:result:${agentResultSlug(agentName)}`
}

export function resolveAiAgentResultsPath(cwd: string, agentName: string): string {
  return join(resolve(cwd), '.iaterminal', AGENT_RESULTS_DIR, `${agentResultSlug(agentName)}.md`)
}

export function extractAiAgentResults(text: string): {
  visibleText: string
  payload: AiAgentResultPayload | null
} {
  let payload: AiAgentResultPayload | null = null
  const visibleText = text.replace(RESULTS_FENCE_RE, (_match, json: string) => {
    if (payload) return ''
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      const summary = normalizeText(value.summary)
      if (!summary) return ''
      const entries = Array.isArray(value.entries)
        ? value.entries
          .map(item => normalizeText(item))
          .filter((item): item is string => item !== null)
          .slice(0, 5)
        : []
      payload = { summary, entries }
    } catch { /* bloque inválido: se oculta y no se persiste */ }
    return ''
  }).trimEnd()
  return { visibleText, payload }
}

function parseLog(raw: string): AiAgentResultLogEntry[] {
  const logSection = raw.match(/##\s+Log\s*\n([\s\S]*?)(?=\n##\s|\n<!--\s*\/iaterminal:auto|$)/i)?.[1] ?? raw
  return [...logSection.matchAll(LOG_ENTRY_RE)]
    .map(match => ({
      timestamp: match[1],
      text: normalizeText(match[2]) ?? '',
    }))
    .filter(entry => entry.text)
    .slice(0, MAX_LOG_ENTRIES)
}

const NOTES_START = '<!-- iaterminal:notes -->'
const NOTES_END = '<!-- /iaterminal:notes -->'

function extractNotesBody(raw: string): string {
  const start = raw.indexOf(NOTES_START)
  const end = raw.indexOf(NOTES_END)
  if (start < 0 || end < 0 || end <= start) return ''
  return raw.slice(start + NOTES_START.length, end).replace(/^\n|\n$/g, '').trim()
}

export function formatAiAgentResultsDocument(options: {
  agentName: string
  summary: string
  entries: AiAgentResultLogEntry[]
  notes?: string
}): string {
  const slug = agentResultSlug(options.agentName)
  const name = options.agentName.trim() || slug
  const metadata = {
    version: 1,
    id: agentResultContextId(name),
    name,
    fileName: agentResultFileName(name),
    kind: 'agentResult',
    icon: 'bot',
    color: '#94a3b8',
  }
  const summary = options.summary.trim() || '(empty)'
  const logLines = options.entries.length
    ? options.entries.map(entry => `- \`${entry.timestamp}\` — ${entry.text}`)
    : ['- (no entries yet)']
  const notesBody = (options.notes ?? '').trim() || '(no annotations yet)'
  return [
    `# ${name} — Results`,
    `<!-- iaterminal:context ${JSON.stringify(metadata)} -->`,
    '',
    '<!-- iaterminal:auto -->',
    '## Latest',
    summary,
    '',
    '## Log',
    ...logLines,
    '<!-- /iaterminal:auto -->',
    '',
    NOTES_START,
    notesBody,
    NOTES_END,
    '',
  ].join('\n')
}

export function upsertAiAgentResults(
  cwd: string,
  agentName: string,
  payload: AiAgentResultPayload,
  timestamp = new Date().toISOString(),
): string {
  const name = agentName.trim()
  if (!name) return ''
  const filePath = resolveAiAgentResultsPath(cwd, name)
  const directory = join(resolve(cwd), '.iaterminal', AGENT_RESULTS_DIR)
  mkdirSync(directory, { recursive: true })

  const previousRaw = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  const previousLog = previousRaw ? parseLog(previousRaw) : []
  const previousNotes = previousRaw ? extractNotesBody(previousRaw) : ''
  const freshEntries = (payload.entries.length ? payload.entries : [payload.summary])
    .map(text => ({ timestamp, text }))
  const entries = [...freshEntries, ...previousLog].slice(0, MAX_LOG_ENTRIES)
  const content = formatAiAgentResultsDocument({
    agentName: name,
    summary: payload.summary,
    entries,
    notes: previousNotes && previousNotes !== '(no annotations yet)' ? previousNotes : undefined,
  })
  const temporaryPath = join(directory, `.${agentResultSlug(name)}.tmp`)
  writeFileSync(temporaryPath, content, 'utf8')
  renameSync(temporaryPath, filePath)
  return filePath
}

export function buildAiAgentResultsInstruction(agentName: string | undefined): string {
  const name = agentName?.trim()
  if (!name) return ''
  return [
    '## Agent results registry',
    `You MUST append the results block on every turn for this agent ("${name}").`,
    'Other agents read this registry. Do not omit the block while emit results is enabled.',
    'Keep it short: one current summary and optional brief log lines.',
    'Use at most 40 words per string. If nothing durable changed, still emit a brief status summary.',
    'Append this exact machine-readable block after your normal answer:',
    '```ia-terminal-results',
    '{"summary":"Current status or outcome","entries":["Optional short log line"]}',
    '```',
  ].join('\n')
}
