import { useEffect, useState } from 'react'
import {
  AGENT_CLI_PROVIDER_IDS,
  type AgentCliProvider,
  type AgentCliResolution,
} from '@shared/agentCliProviders'

export type AgentCliStatuses = Partial<Record<AgentCliProvider, AgentCliResolution>>

/**
 * Disponibilidad de cada CLI en el PATH, para no ofrecer un proveedor que no
 * está instalado. Se pide al abrir (`enabled`) y no al montar: el main
 * re-consulta el PATH cada vez, así que instalar un CLI con la app abierta se
 * nota sin reiniciar. La versión sí la cachea main por ruta absoluta.
 *
 * Mapa vacío = todavía resolviendo; entonces la UI no afirma nada.
 */
export function useAgentCliStatuses(enabled: boolean): AgentCliStatuses {
  const [statuses, setStatuses] = useState<AgentCliStatuses>({})

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void Promise.all(
      AGENT_CLI_PROVIDER_IDS.map(provider => window.api.resolveAgentCli(provider)),
    ).then(resolutions => {
      if (cancelled) return
      const next: AgentCliStatuses = {}
      for (const resolution of resolutions) {
        if (resolution) next[resolution.provider] = resolution
      }
      setStatuses(next)
    }).catch(() => { /* sin resolución: la UI no afirma nada */ })
    return () => { cancelled = true }
  }, [enabled])

  return statuses
}
