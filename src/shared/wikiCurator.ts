/**
 * Modelo puro del agente curador de la wiki: config limitada, prompt del turno
 * y fence `ia-terminal-wiki-view` para abrir pages en modales. Sin fs ni IPC —
 * electron/wikiCurator.ts es quien corre el turno.
 */

import {
  isAgentCliProvider,
  type AgentCliProvider,
} from './agentCliProviders'
import {
  MAX_WIKI_INGEST_OPS,
  MAX_WIKI_LOG_SUMMARY,
  MAX_WIKI_PAGE_BODY,
  MAX_WIKI_PAGE_TITLE,
  WIKI_PAGE_TYPES,
  buildWikiWritingGuidance,
  normalizeWikiSlug,
} from './wikiDoc'

export const MAX_WIKI_CURATOR_NAME = 40
export const MAX_WIKI_CURATOR_RULES = 5
export const MAX_WIKI_CURATOR_RULE_CHARS = 200
export const MAX_WIKI_VIEW_SLUGS = 5

export interface WikiCuratorConfig {
  name?: string
  /** CLI del curador; ausente → Claude en el runner. */
  provider?: AgentCliProvider
  model?: string
  rules?: string[]
}

/** Eventos IPC del turno del curador hacia el renderer (contrato puro, sin Electron). */
export type WikiCuratorEvent =
  | { type: 'delta'; text: string }
  | { type: 'final'; text: string }
  | { type: 'view'; slugs: string[] }
  | { type: 'applied'; opsCount: number }
  | { type: 'error'; message: string }
  | { type: 'done' }

/** Sanitiza una config cruda (UI o disco): recorta, capea y descarta inválidos. */
export function sanitizeWikiCuratorConfig(value: unknown): WikiCuratorConfig {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const config: WikiCuratorConfig = {}
  if (typeof raw.name === 'string' && raw.name.trim()) {
    config.name = raw.name.trim().slice(0, MAX_WIKI_CURATOR_NAME)
  }
  // Solo persiste provider conocido; inválido se omite (runner cae a Claude).
  if (isAgentCliProvider(raw.provider)) {
    config.provider = raw.provider
  }
  if (typeof raw.model === 'string' && raw.model.trim()) {
    config.model = raw.model.trim()
  }
  if (Array.isArray(raw.rules)) {
    const rules = raw.rules
      .filter((rule): rule is string => typeof rule === 'string')
      .map(rule => rule.trim())
      .filter(Boolean)
      .slice(0, MAX_WIKI_CURATOR_RULES)
      .map(rule => rule.slice(0, MAX_WIKI_CURATOR_RULE_CHARS))
    if (rules.length) config.rules = rules
  }
  return config
}

/** Parse desde el JSON de `.gravity/wiki/curator.json`; inválido → config vacía. */
export function parseWikiCuratorConfig(json: string): WikiCuratorConfig {
  try {
    return sanitizeWikiCuratorConfig(JSON.parse(json))
  } catch {
    return {}
  }
}

/**
 * Prompt del turno del curador. Rol fijo: gestor de información de la wiki —
 * no programa ni toca archivos; solo opera vía los dos fences del protocolo.
 */
export function buildWikiCuratorPrompt(
  config: WikiCuratorConfig,
  userMessage: string,
  healthSection?: string,
): string {
  const name = config.name?.trim() || 'Wiki curator'
  const rules = config.rules ?? []
  return [
    '## Role',
    `You are ${name}, the wiki information manager for this project.`,
    'You do NOT write code, do NOT run commands and do NOT touch files directly.',
    'Your only job is to manage the wiki knowledge: answer about pages, edit them, delete them or open them for the user.',
    'Always respond in the same language the user writes in.',
    '',
    '## Writing',
    buildWikiWritingGuidance(),
    '',
    '## Protocol',
    'You may only emit these two fences; any other control fence is forbidden.',
    'To edit or delete wiki pages, emit one `ia-terminal-wiki` fence:',
    `Caps: ≤${MAX_WIKI_INGEST_OPS} ops/turn, body ≤${MAX_WIKI_PAGE_BODY}, title ≤${MAX_WIKI_PAGE_TITLE}, log ≤${MAX_WIKI_LOG_SUMMARY}. Types: ${WIKI_PAGE_TYPES.join('|')}.`,
    '```ia-terminal-wiki',
    '{"ops":[{"op":"upsert","slug":"create-agent","title":"Create agent","type":"flow","body":"Picker → .gravity/agents/<slug>.json → pane agent. UI: AgentProviderPickerModal.tsx. Persist: projectAgentCatalogOps.ts. See [[agent-identity]] [[pane-windows]]."},{"op":"delete","slug":"old-page"}],"log":"one line about the change"}',
    '```',
    `To ask the UI to open pages in modals for the user, emit one \`ia-terminal-wiki-view\` fence (≤${MAX_WIKI_VIEW_SLUGS} slugs):`,
    '```ia-terminal-wiki-view',
    '{"slugs":["auth-flow","deploy-pipeline"]}',
    '```',
    'The fences are applied by the host and never shown to the user; keep your visible answer short and precise.',
    ...(rules.length ? ['', '## Rules', ...rules.map(rule => `- ${rule}`)] : []),
    ...(healthSection?.trim()
      ? [
          '',
          '## Wiki health',
          healthSection.trim(),
          'When the user asks for maintenance, fix these via ia-terminal-wiki ops; otherwise mention them briefly if relevant.',
        ]
      : []),
    '',
    '## User message',
    userMessage.trim(),
  ].join('\n')
}

const WIKI_VIEW_FENCE_RE = /```ia-terminal-wiki-view\s*\n([\s\S]*?)\n```/g

export interface WikiViewRequest {
  visibleText: string
  /** Slugs normalizados, sin duplicados, cap 5. Vacío = no hubo pedido válido. */
  slugs: string[]
}

/**
 * Extrae los fences ```ia-terminal-wiki-view``` y devuelve el texto limpio.
 * Mismo patrón que extractWikiIngest (wikiDoc.ts): JSON inválido → el fence se
 * oculta igual, pero no abre nada.
 */
export function extractWikiViewRequest(text: string): WikiViewRequest {
  const slugs: string[] = []
  const seen = new Set<string>()
  const visibleText = text.replace(WIKI_VIEW_FENCE_RE, (_match, json: string) => {
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      if (Array.isArray(value.slugs)) {
        for (const raw of value.slugs) {
          if (slugs.length >= MAX_WIKI_VIEW_SLUGS) break
          if (typeof raw !== 'string' || !raw.trim()) continue
          const slug = normalizeWikiSlug(raw)
          if (!slug || seen.has(slug)) continue
          seen.add(slug)
          slugs.push(slug)
        }
      }
    } catch { /* fence inválido: se oculta, pero no se abre nada */ }
    return ''
  }).trimEnd()
  return { visibleText, slugs }
}
