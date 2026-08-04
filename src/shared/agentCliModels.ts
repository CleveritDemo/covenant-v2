/** Opciones de modelo para paneles de agente (flags `--model` de cada CLI). */

import type { AgentCliProvider } from './projectAgentCatalog'

export interface AgentModelOption {
  id: string
  label: string
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
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
  { id: 'haiku', label: 'Haiku' },
  { id: 'fable', label: 'Fable' },
]

/** Fallback si `agent --list-models` falla. */
export const CURSOR_AGENT_MODELS: AgentModelOption[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'composer-2.5', label: 'Composer 2.5' },
  { id: 'claude-fable-5-thinking-high', label: 'Fable 5 Thinking' },
  { id: 'claude-opus-4-8-thinking-high', label: 'Opus 4.8 Thinking' },
  { id: 'gpt-5.6-sol-xhigh', label: 'GPT-5.6 Sol Extra High' },
  { id: 'gpt-5.5-high', label: 'GPT-5.5 High' },
  { id: 'gpt-5.3-codex-high', label: 'Codex 5.3 High' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
]

/**
 * Fallback si Copilot no expone listado en `help`
 * (verificado vía `copilot -p '/models'` / docs CLI).
 */
export const COPILOT_AGENT_MODELS: AgentModelOption[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6' },
  { id: 'gpt-5.4', label: 'GPT-5.4' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5' },
  { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
]

/** Fallback estático por provider (solo si el CLI no responde). */
export function modelsForProvider(provider: AgentCliProvider): AgentModelOption[] {
  if (provider === 'claude') return CLAUDE_AGENT_MODELS
  if (provider === 'copilot') return COPILOT_AGENT_MODELS
  return CURSOR_AGENT_MODELS
}
