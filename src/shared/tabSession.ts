/**
 * Forma persistida de una pestaña (session.json). Vive en `src/shared` porque
 * la usan tanto el renderer (`App.tsx`) como el main process
 * (`electron/persistence.ts`); un import renderer ↔ main cruzaría los grafos
 * de tsconfig.web / tsconfig.node.
 */
import type { TabContext } from './tabContext'

export interface TabSplitSizes {
  /** Fracción 0–1 del ancho de la columna izquierda (paneles con 2 columnas). */
  columnRatio: number
  /** Fracción 0–1 de la altura de la fila superior (3 y 4 paneles). */
  rowRatio?: number
}

export type PaneKind = 'terminal' | 'agent'
export type AgentCliProvider = 'claude' | 'cursor'
export type AgentPermissionMode = 'ask' | 'auto' | 'plan'

export interface AgentPaneMeta {
  provider: AgentCliProvider
  permissionMode: AgentPermissionMode
  /** Nombre visible del agente en el plano y la ventana; también va al CLI. */
  name?: string
  /** Rol del agente (p. ej. arquitecto, reviewer); se envía en cada turno. */
  role?: string
  /** Objetivo persistente del agente; se envía en cada turno. */
  objective?: string
  /** Modelo del CLI (`--model`); ausente = predeterminado del proveedor. */
  model?: string
  /** Contextos de esta tab asignados al agente. */
  contextIds?: string[]
  /** Permite que el agente haga upsert de anotaciones al terminar cada turno. */
  autoImproveContexts?: boolean
  /** ID devuelto por el CLI para reanudar el chat entre turnos/reinicios. */
  cliSessionId?: string
}

/** Estado persistido de ventana flotante (geometría se calcula al render). */
export interface PaneWindowState {
  open: boolean
  /** Ventana maximizada al área del plano (persiste al reiniciar). */
  fullscreen: boolean
  zIndex: number
}

export interface TabSession {
  id: string
  title: string
  /** Tras renombrar a mano: el título del PTY no sustituye `title` */
  titleLocked?: boolean
  /** Cada panel = una sesión (UUID); puede estar vacío (plano sin nodos). */
  paneIds: string[]
  /** Panel enfocado; `''` si el plano no tiene paneles. */
  activePaneId: string
  /**
   * @deprecated Layout split clásico; se migra a `paneWindows` al cargar.
   */
  splitSizes?: TabSplitSizes
  /** Ausente equivale a terminal para compatibilidad con sesiones anteriores. */
  paneKinds?: Record<string, PaneKind>
  /** Metadatos de los paneles de agente, indexados por paneId. */
  agentByPane?: Record<string, AgentPaneMeta>
  /** Ventanas del plano agéntico por paneId. */
  paneWindows?: Record<string, PaneWindowState>
  /**
   * Carpeta de proyecto de la pestaña. Las terminales nuevas arrancan aquí
   * (no heredan el cwd de otras terminales).
   */
  projectFolder?: string
  /**
   * @deprecated El catálogo vive en `.iaterminal/*.md`. Se ignora al cargar;
   * solo se persisten `agentByPane[].contextIds`.
   */
  contexts?: TabContext[]
}
