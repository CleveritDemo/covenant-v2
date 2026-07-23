/**
 * Forma persistida de una pestaña (session.json). Vive en `src/shared` porque
 * la usan tanto el renderer (`App.tsx`) como el main process
 * (`electron/persistence.ts`); un import renderer ↔ main cruzaría los grafos
 * de tsconfig.web / tsconfig.node.
 */
import type { TabContext } from './tabContext'
import type { PlaneLoopLink, PlaneLoopNodePosition } from './planeLoopGraph'
import type { PlaneLoopChain } from './planeLoopChain'
import type {
  AgentCliProvider,
  AgentPaneBinding,
  AgentPaneMeta,
  AgentPermissionMode,
  ProjectAgentDefinition,
} from './projectAgentCatalog'

export type { PlaneLoopLink, PlaneLoopNodePosition, PlaneLoopChain }
export type {
  AgentCliProvider,
  AgentPaneBinding,
  AgentPaneMeta,
  AgentPermissionMode,
  ProjectAgentDefinition,
}

export interface TabSplitSizes {
  /** Fracción 0–1 del ancho de la columna izquierda (paneles con 2 columnas). */
  columnRatio: number
  /** Fracción 0–1 de la altura de la fila superior (3 y 4 paneles). */
  rowRatio?: number
}

export type PaneKind = 'terminal' | 'agent'

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
  /**
   * Enlace local pane → agente del catálogo del proyecto.
   * La config compartible vive en `.iaterminal/agents/<agentId>.json`.
   */
  agentByPane?: Record<string, AgentPaneBinding>
  /** Ventanas del plano agéntico por paneId. */
  paneWindows?: Record<string, PaneWindowState>
  /**
   * Chat del plano abierto en el composer (`null` = ninguno).
   * Se elige con las badges; volver a pulsar la abierta lo oculta.
   */
  planeOpenChatAgentId?: string | null
  /**
   * Carpeta de proyecto de la pestaña. Las terminales nuevas arrancan aquí
   * (no heredan el cwd de otras terminales).
   */
  projectFolder?: string
  /**
   * @deprecated Legacy nest links; ya no se orquestan. Se mantienen por sanitize.
   */
  planeLoopLinks?: PlaneLoopLink[]
  /** Posiciones de nodos en el lienzo legacy de loops (por paneId). */
  planeLoopNodePositions?: Record<string, PlaneLoopNodePosition>
  /** Cadenas multi-agente A→B→C… con intervalo al final del ciclo. */
  planeLoopChains?: PlaneLoopChain[]
  /**
   * @deprecated El catálogo vive en `.iaterminal/*.md`. Se ignora al cargar;
   * las asignaciones van en el JSON del agente en `.iaterminal/agents/`.
   */
  contexts?: TabContext[]
}
