import type {
  AgentCliProvider,
  AgentPermissionMode,
} from './tabSession'
import type { TabContext } from './tabContext'
import type {
  DelegateResult,
  OrchestrationAgentRef,
} from './agentOrchestration'
import type { DelegationRuntimeEntry } from './delegationRuntimeRegistry'
import type { AgentNativeSkills } from './projectAgentCatalog'

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
  /** Hilo dueño del turno; ausente = DEFAULT_THREAD_ID. */
  threadId?: string
  provider: AgentCliProvider
  /**
   * Recambio si el primario cae por sobrecarga/rate limit.
   * Omitido o igual al primario = sin recambio.
   */
  fallbackProvider?: AgentCliProvider
  prompt: string
  /** Cwd del spawn CLI (puede ser worktree). */
  cwd: string
  /**
   * Carpeta del proyecto donde vive `.gravity/` (contexts, results, changelog,
   * clipboard-images). Si falta, se usa `cwd`. El spawn del CLI sigue usando `cwd`.
   */
  projectCwd?: string
  /**
   * Cuerpos markdown en memoria (p. ej. notes org) por contextId.
   * Se pasan a materializeTabContext como `content` cuando aplica.
   */
  contextContents?: Record<string, string>
  permissionMode: AgentPermissionMode
  /** Nombre del agente; se inyecta en el prompt del turno. */
  name?: string
  /** Id estable del catálogo; resultados y contextIds usan este id. */
  agentId?: string
  /**
   * Workspace org de la pestaña como `<slug>/<workspaceId>`. Solo lo consume
   * la instrumentación de Pulse; no entra en el prompt ni en los flags del CLI.
   */
  workspace?: string
  /** El turno lo disparó un loop; solo lo consume la instrumentación de Pulse. */
  viaLoop?: boolean
  /** Rol del agente; se inyecta en el prompt del turno. */
  role?: string
  /** Objetivo persistente; se inyecta en el prompt del turno. */
  objective?: string
  /** Reglas de comportamiento; se inyectan en el prompt de cada turno. */
  rules?: string[]
  /** Si viene, se pasa como `--model` al CLI. */
  model?: string
  /** Skills de plugin visibles; omitido = ninguna. */
  nativeSkills?: AgentNativeSkills
  /** Servidores MCP permitidos por id; omitido = ninguno. */
  mcpsAllowed?: string[]
  /** Definiciones asignadas; main las materializa contra projectCwd justo al enviar. */
  contexts?: TabContext[]
  /** Catálogo descubierto en disco (para sugerencias; no se adjuntan solos). */
  discoveredContexts?: TabContext[]
  /** Inyecta el protocolo de registro de resultados y persiste el bloque emitido. */
  emitResults?: boolean
  /** Inyecta protocolo de changelog y persiste bloque emitido. Default true. */
  emitChangelog?: boolean
  /**
   * Ids de agentes vivos en el mismo tab/plano. El host inyecta hasta 5 results
   * recientes de cada uno (si existen) en el prompt del turno.
   */
  tabAgentIds?: string[]
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
  /** Tope de delegaciones por turno del orquestador (0 = sin tope). */
  maxDelegationsPerTurn?: number
  /** Especialistas del plano visibles para el orquestador. */
  orchestrationAgents?: OrchestrationAgentRef[]
  /**
   * Orquestador puede pedir varias delegaciones al mismo rol en carriles paralelos.
   * No afecta el aislamiento por worktree (siempre on si hay repo).
   */
  allowParallelLanes?: boolean
  /** @deprecated Lectura legacy; usar allowParallelLanes. */
  allowExpertReplicas?: boolean
  /** Solo orchestrator: linear (espera ola) | turbo (jobs humanos concurrentes). */
  orchestrationWorkStyle?: 'linear' | 'turbo'
  /** Turbo: job/hilo activo de este turno (humano o follow-up). */
  orchestrationJobId?: string
  /** Carriles vivos del orquestador para el bloque de prompt. */
  inflightDelegations?: DelegationRuntimeEntry[]
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
  | { type: 'harness_fallback'; from: AgentCliProvider; to: AgentCliProvider }
  | {
    type: 'delegate'
    delegations: Array<{
      id: string
      toAgentId: string
      objective: string
      contextIds?: string[]
    }>
    /** Dueño del turno en turbo; evita mezclar olas entre jobs concurrentes. */
    orchestrationJobId?: string
    warnings?: string[]
  }
  /** Cierre ordenado del turno en el mismo canal que el stream (evita carreras con EXIT). */
  | { type: 'done'; code: number }

/** Preview de un adjunto enviado; historial del chat y lightbox al ampliar. */
export interface AgentChatImage {
  name: string
  /**
   * Data URL de preview (lado largo ≤ ~1280px), no la original.
   * Sirve de miniatura en el hilo (CSS) y de vista ampliada.
   */
  dataUrl: string
}

export interface AgentChatEntry {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** Previews de imágenes adjuntas al mensaje del usuario. */
  images?: AgentChatImage[]
  /**
   * Cómo pintar la entrada. `delegationResult`: follow-up de orquestación
   * inyectado por el host; se muestra como tarjeta, no como mensaje humano.
   * `content` sigue siendo el texto íntegro que recibió el CLI.
   */
  presentation?: 'delegationResult'
}


/**
 * Contadores acumulados desde el arranque de main. Vive aquí y no en
 * `electron/agentCliRuntime.ts` porque el preload los expone al renderer, y
 * este es el lado que los dos grafos pueden importar.
 */
export interface ContextDeliveryMetrics {
  catalogChars: number
  sectionsRequested: number
  sectionsDelivered: number
  sectionsPreattached: number
  /** Tokens que el CLI reporta al cerrar cada turno, acumulados. */
  inputTokens: number
  outputTokens: number
}
