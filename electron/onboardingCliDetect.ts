/**
 * Detecta qué CLIs de agente están instalados (para el wizard de onboarding).
 * Nunca lanza: un provider que falle cuenta como no instalado.
 */
import type { AppConfig } from '../src/shared/configSchema'
import {
  AGENT_CLI_PROVIDER_IDS,
  AGENT_CLI_PROVIDERS,
} from '../src/shared/agentCliProviders'
import type { OnboardingCliStatus } from '../src/shared/onboarding'
import { resolveAgentCli } from './agentCliResolve'

export async function detectOnboardingClis(config: AppConfig): Promise<OnboardingCliStatus[]> {
  return Promise.all(
    AGENT_CLI_PROVIDER_IDS.map(async (provider): Promise<OnboardingCliStatus> => {
      const { label, command } = AGENT_CLI_PROVIDERS[provider]
      try {
        const resolution = await resolveAgentCli(
          provider,
          config.agentCliCommands?.[provider],
          config,
        )
        const installed = Boolean(resolution.path)
        return {
          provider,
          label,
          command,
          installed,
          version: installed ? resolution.version : null,
        }
      } catch {
        return {
          provider,
          label,
          command,
          installed: false,
          version: null,
        }
      }
    }),
  )
}
