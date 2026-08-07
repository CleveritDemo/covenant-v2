/**
 * Estado de instalación de cada CLI de agente.
 *
 * El modal de configuración lo usa para avisar «este proveedor no está en el
 * PATH» al elegirlo, en vez de fallar al mandar el primer turno.
 */
import type { AgentCliProvider } from './agentCliProviders'

export interface AgentCliStatus {
  /** Ejecutable buscado (config del usuario o default del proveedor). */
  command: string
  /** false = no aparece en el PATH. */
  found: boolean
  /** Ruta resuelta cuando existe (symlinks ya seguidos). */
  path?: string
}

export type AgentCliStatusMap = Partial<Record<AgentCliProvider, AgentCliStatus>>
