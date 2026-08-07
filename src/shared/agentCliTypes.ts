import type {
  AgentCliProvider,
  AgentPermissionMode,
} from './tabSession'
import type { TabContext } from './tabContext'
import type {
  DelegateResult,
  OrchestrationAgentRef,
} from './agentOrchestration'

/** Imagen pegada desde el portapapeles; main la escribe a disco antes del turno. */
export interface AgentCliImageAttachment {
  /** Nombre de archivo sugerido (p. ej. paste-1.png). */
  name: string
  mimeType: string
  /** Contenido en base64 (sin prefijo data:). */
  base64: string
}

export interface AgentCliStartRequest {
  paneId: string
  provider: AgentCliProvider
  prompt: string
  cwd: string
  permissionMode: AgentPermissionMode
  /** Nombre del agente; se inyecta en el prompt del turno. */
  name?: string
  /** Id estable del catálogo; resultados y contextIds usan este id. */
  agentId?: string
  /** Rol del agente; se inyecta en el prompt del turno. */
  role?: string
  /** Objetivo persistente; se inyecta en el prompt del turno. */
  objective?: string
  /** Reglas de comportamiento; se inyectan en el prompt de cada turno. */
  rules?: string[]
  /** Si viene, se pasa como `--model` al CLI. */
  model?: string
  /** Definiciones asignadas; main las materializa contra cwd justo al enviar. */
  contexts?: TabContext[]
  /** Catálogo descubierto en disco (para sugerencias; no se adjuntan solos). */
  discoveredContexts?: TabContext[]
  /** Inyecta el protocolo de actualización incremental de anotaciones. */
  autoImproveContexts?: boolean
  /** Inyecta el protocolo de registro de resultados y persiste el bloque emitido. */
  emitResults?: boolean
  /** Tras migración de ids de contexto, forzar refresh completo del snapshot. */
  forceContextFullRefresh?: boolean
  /** Orquestador / product owner: prompt de delegación + parse del fence. */
  coordination?: 'none' | 'orchestrator' | 'productOwner'
  /** Si false, el host prohíbe nuevas delegaciones en este turno. */
  allowDelegations?: boolean
  /** Oleada actual (1..max) para el prompt del orquestador. */
  orchestrationRound?: number
  /** Tope de oleadas por pedido del usuario. */
  orchestrationMaxRounds?: number
  /** Especialistas del plano visibles para el orquestador. */
  orchestrationAgents?: OrchestrationAgentRef[]
  /** Resultados de delegaciones previas a inyectar en el prompt. */
  pendingDelegationResults?: DelegateResult[]
  cliSessionId?: string
  /** Fotos pegadas en el composer; se guardan bajo .gravity/clipboard-images. */
  images?: AgentCliImageAttachment[]
}

export type AgentCliUiEvent =
  | { type: 'assistant_delta'; text: string; source?: 'create_plan' }
  | { type: 'assistant_final'; text: string }
  | { type: 'tool'; name: string; status: 'started' | 'completed'; detail?: string }
  | { type: 'context'; status: 'loading' | 'loaded'; detail?: string }
  | { type: 'session'; cliSessionId: string }
  | { type: 'error'; message: string }
  | {
    type: 'delegate'
    delegations: Array<{
      id: string
      toAgentId: string
      objective: string
      contextIds?: string[]
    }>
  }
  /** Cierre ordenado del turno en el mismo canal que el stream (evita carreras con EXIT). */
  | { type: 'done'; code: number }

/** Miniatura de un adjunto enviado; solo para mostrar en el historial del chat. */
export interface AgentChatImage {
  name: string
  /** Data URL pequeña (miniatura), no la imagen original. */
  dataUrl: string
}

export interface AgentChatEntry {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Previews de imágenes adjuntas al mensaje del usuario. */
  images?: AgentChatImage[]
}

