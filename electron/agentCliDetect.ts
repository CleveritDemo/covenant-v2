/**
 * Qué CLIs de agente están instalados.
 *
 * ponytail: solo busca el ejecutable en el PATH (stat, sin procesos). No
 * ejecuta `--version` a propósito: serían 9 spawns por apertura del modal, con
 * riesgo de CLIs que se quedan esperando en un prompt. Si algún día hace falta
 * mostrar la versión, se añade un spawn cacheado por comando.
 */
import type { AppConfig } from '../src/shared/configSchema'
import {
  AGENT_CLI_PROVIDER_IDS,
  agentCliCommand,
  type AgentCliProvider,
} from '../src/shared/agentCliProviders'
import type { AgentCliStatus, AgentCliStatusMap } from '../src/shared/agentCliStatus'
import { resolveCommandAbsolutePath } from './agentCliModelsList'

export function detectAgentCli(
  provider: AgentCliProvider,
  config: Pick<AppConfig, 'agentCliCommands'>,
): AgentCliStatus {
  const command = agentCliCommand(config.agentCliCommands, provider)
  const path = resolveCommandAbsolutePath(command)
  return path ? { command, found: true, path } : { command, found: false }
}

export function detectAgentClis(
  config: Pick<AppConfig, 'agentCliCommands'>,
): AgentCliStatusMap {
  const out: AgentCliStatusMap = {}
  for (const provider of AGENT_CLI_PROVIDER_IDS) {
    out[provider] = detectAgentCli(provider, config)
  }
  return out
}
