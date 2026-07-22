import type {
  AgentCliProvider,
  AgentPermissionMode,
} from './tabSession'
import type { TabContext } from './tabContext'

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
  /** Rol del agente; se inyecta en el prompt del turno. */
  role?: string
  /** Objetivo persistente; se inyecta en el prompt del turno. */
  objective?: string
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
  cliSessionId?: string
  /** Fotos pegadas en el composer; se guardan bajo .iaterminal/clipboard-images. */
  images?: AgentCliImageAttachment[]
}

export type AgentCliUiEvent =
  | { type: 'assistant_delta'; text: string; source?: 'create_plan' }
  | { type: 'assistant_final'; text: string }
  | { type: 'tool'; name: string; status: 'started' | 'completed'; detail?: string }
  | { type: 'context'; status: 'loading' | 'loaded'; detail?: string }
  | { type: 'session'; cliSessionId: string }
  | { type: 'error'; message: string }
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

