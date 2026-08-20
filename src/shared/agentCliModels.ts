/** Opciones de modelo para paneles de agente (flags `--model` de cada CLI). */

import type { AgentCliProvider } from './projectAgentCatalog'

export interface AgentModelOption {
  id: string
  label: string
  /**
   * Código corto para chips densos (mini card). Familia + dígitos de versión,
   * 2–4 caracteres. Si falta, `deriveModelShort` lo infiere del id/label.
   */
  short?: string
}

/** Resultado de listar modelos (IPC / helper Electron). */
export interface AgentCliModelsResult {
  models: AgentModelOption[]
  /** Origen de la lista: CLI real o fallback estático. */
  source: 'cli' | 'fallback'
  /** Error del CLI cuando se usó fallback o falló del todo. */
  error?: string
}

/**
 * Fallback si el CLI no lista modelos (auth, timeout, sin flag).
 * Solo aliases documentados en `--help` / docs del CLI.
 */
export const CLAUDE_AGENT_MODELS: AgentModelOption[] = [
  { id: 'sonnet', label: 'Sonnet', short: 'S' },
  { id: 'opus', label: 'Opus', short: 'O' },
  { id: 'haiku', label: 'Haiku', short: 'H' },
  { id: 'fable', label: 'Fable', short: 'FB' },
]

/** Fallback si `agent --list-models` falla. */
export const CURSOR_AGENT_MODELS: AgentModelOption[] = [
  { id: 'auto', label: 'Auto', short: 'A' },
  { id: 'composer-2.5', label: 'Composer 2.5', short: 'C25' },
  { id: 'claude-fable-5-thinking-high', label: 'Fable 5 Thinking', short: 'FB5' },
  { id: 'claude-opus-4-8-thinking-high', label: 'Opus 4.8 Thinking', short: 'O48' },
  { id: 'gpt-5.6-sol-xhigh', label: 'GPT-5.6 Sol Extra High', short: 'G56' },
  { id: 'gpt-5.5-high', label: 'GPT-5.5 High', short: 'G55' },
  { id: 'gpt-5.3-codex-high', label: 'Codex 5.3 High', short: 'CX53' },
  { id: 'gpt-5.2', label: 'GPT-5.2', short: 'G52' },
]

/**
 * Fallback si Copilot no expone un listado completo en `help` / `/models`.
 * IDs verificados en el paquete CLI instalado (`app.js` catálogo sweagent-capi)
 * y en la salida de `copilot -p '/models'` / docs `--model`.
 */
export const COPILOT_AGENT_MODELS: AgentModelOption[] = [
  { id: 'auto', label: 'Auto', short: 'A' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', short: 'S46' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', short: 'O46' },
  { id: 'gpt-5.4', label: 'GPT-5.4', short: 'G54' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', short: 'H45' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', short: 'CX53' },
  { id: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5', short: 'S45' },
  { id: 'claude-opus-4.5', label: 'Claude Opus 4.5', short: 'O45' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', short: 'S5' },
  { id: 'claude-opus-4.7', label: 'Claude Opus 4.7', short: 'O47' },
  { id: 'claude-opus-4.8', label: 'Claude Opus 4.8', short: 'O48' },
  { id: 'gpt-5.5', label: 'GPT-5.5', short: 'G55' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', short: 'G54m' },
  { id: 'gpt-5-mini', label: 'GPT-5 Mini', short: 'G5m' },
  { id: 'gpt-5.2', label: 'GPT-5.2', short: 'G52' },
  { id: 'gpt-5.2-codex', label: 'GPT-5.2 Codex', short: 'CX52' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', short: 'GM31' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', short: 'GM35' },
  { id: 'claude-opus-4.6-fast', label: 'Claude Opus 4.6 Fast', short: 'O46f' },
  { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex', short: 'CX51' },
]

/**
 * Catálogo estático de Gemini: el CLI no expone comando de listado.
 * IDs verificados en el bundle `@google/gemini-cli` instalado.
 */
export const GEMINI_AGENT_MODELS: AgentModelOption[] = [
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', short: 'GM31' },
  { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', short: 'GM3' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', short: 'GM35' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', short: 'GM3f' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', short: 'GM25' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', short: 'G25f' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', short: 'G25l' },
]

/**
 * Catálogo estático de Grok: el CLI no expone comando de listado.
 * IDs de la doc del CLI; `grok-code-fast-1` es su default.
 */
export const GROK_AGENT_MODELS: AgentModelOption[] = [
  { id: 'grok-code-fast-1', label: 'Grok Code Fast', short: 'GKf' },
  { id: 'grok-4-latest', label: 'Grok 4', short: 'GK4' },
]

const FAMILY_CODES: Array<{ match: RegExp; code: string }> = [
  { match: /\bfable\b/, code: 'FB' },
  { match: /\bcomposer\b/, code: 'C' },
  { match: /\bcodex\b/, code: 'CX' },
  { match: /\bsonnet\b/, code: 'S' },
  { match: /\bopus\b/, code: 'O' },
  { match: /\bhaiku\b/, code: 'H' },
  { match: /\bgemini\b/, code: 'GM' },
  { match: /\bgrok\b/, code: 'GK' },
  { match: /\bgpt\b/, code: 'G' },
  { match: /\bauto\b/, code: 'A' },
]

const SKIP_VERSION_TOKENS = new Set([
  'thinking',
  'high',
  'xhigh',
  'extra',
  'preview',
  'latest',
  'sol',
  'claude',
  'code',
  'fast',
  'pro',
  'flash',
  'lite',
  'mini',
])

/** Fallback estático por provider (solo si el CLI no responde). */
export function modelsForProvider(provider: AgentCliProvider): AgentModelOption[] {
  if (provider === 'claude') return CLAUDE_AGENT_MODELS
  if (provider === 'copilot') return COPILOT_AGENT_MODELS
  if (provider === 'cursor') return CURSOR_AGENT_MODELS
  if (provider === 'gemini') return GEMINI_AGENT_MODELS
  if (provider === 'grok') return GROK_AGENT_MODELS
  // Resto de CLIs: sin catálogo propio; se usa el modelo por defecto del CLI.
  return []
}

/**
 * Infiere un código corto (familia + dígitos de versión) desde id o label.
 * Cualificadores (thinking, high, preview…) no entran; van en el label largo.
 */
export function deriveModelShort(idOrLabel: string): string {
  const raw = idOrLabel.trim()
  if (!raw) return ''
  const normalized = raw.toLowerCase().replace(/[_./]+/g, ' ').replace(/-/g, ' ')
  const family = FAMILY_CODES.find(entry => entry.match.test(normalized))?.code
    ?? raw.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
  if (!family) return raw.slice(0, 4).toUpperCase()

  const versionDigits = normalized
    .split(/\s+/)
    .filter(token => token && !SKIP_VERSION_TOKENS.has(token) && !FAMILY_CODES.some(entry => entry.match.test(token)))
    .flatMap(token => token.match(/\d+/g) ?? [])
    .join('')
    .slice(0, 3)

  const suffix = /\bmini\b/.test(normalized)
    ? 'm'
    : /\bflash\b/.test(normalized)
      ? 'f'
      : /\blite\b/.test(normalized)
        ? 'l'
        : /\bfast\b/.test(normalized) && family !== 'GKf'
          ? 'f'
          : ''

  const short = `${family}${versionDigits}${suffix}`
  return short.slice(0, 4) || family
}

/** Label largo del modelo (config, tooltip). */
export function resolveModelLabel(
  provider: AgentCliProvider,
  modelId: string,
): string {
  const id = modelId.trim()
  if (!id) return ''
  return modelsForProvider(provider).find(option => option.id === id)?.label ?? id
}

/**
 * Chip de la mini cuando el modelo está vacío (default del CLI).
 * Tres letras, mismo formato que el resto de códigos cortos.
 */
export const MODEL_DEFAULT_SHORT = 'DEF'

/**
 * Código para el chip de la mini: `short` del catálogo, o derive del id/label.
 * Modelo vacío → {@link MODEL_DEFAULT_SHORT}.
 */
export function resolveModelShort(
  provider: AgentCliProvider,
  modelId: string,
): string {
  const id = modelId.trim()
  if (!id) return MODEL_DEFAULT_SHORT
  const option = modelsForProvider(provider).find(entry => entry.id === id)
  if (option?.short?.trim()) return option.short.trim()
  return deriveModelShort(option?.label ?? id)
}
