import type { AgentCliProvider } from './agentCliProviders'

/** Versión del flujo de onboarding; al completarlo se persiste en AppConfig. */
export const ONBOARDING_VERSION = '4'

/** Los dos perfiles de arranque; deciden la escalera in-plane. */
export const ORCHESTRATOR_PATHS = ['business', 'engineer'] as const
export type OrchestratorPath = typeof ORCHESTRATOR_PATHS[number]
/** '' = el usuario todavía no eligió. Cualquier valor desconocido cae a ''. */
export function sanitizeOrchestratorPath(value: unknown): OrchestratorPath | '' {
  if (typeof value !== 'string') return ''
  return (ORCHESTRATOR_PATHS as readonly string[]).includes(value)
    ? (value as OrchestratorPath)
    : ''
}

/** Estado de un CLI de agente en la máquina, para el detect del onboarding. */
export interface OnboardingCliStatus {
  provider: AgentCliProvider
  /** Nombre de marca desde `AGENT_CLI_PROVIDERS`. */
  label: string
  /** Ejecutable por defecto desde `AGENT_CLI_PROVIDERS`. */
  command: string
  installed: boolean
  version: string | null
}
