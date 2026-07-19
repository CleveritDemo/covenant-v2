/** Opciones de modelo para paneles de agente (flags `--model` de cada CLI). */

export interface AgentModelOption {
  id: string
  label: string
}

/** Aliases que Claude Code acepta con `--model` / `/model`. */
export const CLAUDE_AGENT_MODELS: AgentModelOption[] = [
  { id: 'sonnet', label: 'Sonnet' },
  { id: 'opus', label: 'Opus' },
  { id: 'haiku', label: 'Haiku' },
  { id: 'fable', label: 'Fable' },
]

/**
 * Subconjunto útil de `agent --list-models`.
 * Si el usuario elige otro ID, se conserva y se muestra como opción personalizada.
 */
export const CURSOR_AGENT_MODELS: AgentModelOption[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'composer-2.5', label: 'Composer 2.5' },
  { id: 'claude-fable-5-thinking-high', label: 'Fable 5 Thinking' },
  { id: 'claude-opus-4-8-thinking-high', label: 'Opus 4.8 Thinking' },
  { id: 'gpt-5.6-sol-xhigh', label: 'GPT-5.6 Sol Extra High' },
  { id: 'gpt-5.6-sol-high', label: 'GPT-5.6 Sol High' },
  { id: 'gpt-5.5-high', label: 'GPT-5.5 High' },
  { id: 'gpt-5.3-codex-high', label: 'Codex 5.3 High' },
  { id: 'gpt-5.3-codex', label: 'Codex 5.3' },
  { id: 'gpt-5.2', label: 'GPT-5.2' },
  { id: 'cursor-grok-4.5-high', label: 'Grok 4.5' },
]

export function modelsForProvider(provider: 'claude' | 'cursor'): AgentModelOption[] {
  return provider === 'claude' ? CLAUDE_AGENT_MODELS : CURSOR_AGENT_MODELS
}
