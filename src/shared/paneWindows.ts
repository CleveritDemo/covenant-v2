import type { PaneWindowState } from '@shared/tabSession'

export const PANE_WINDOW_MIN_WIDTH = 320
export const PANE_WINDOW_MIN_HEIGHT = 200
/** Fracción del viewport del plano para ventanas abiertas (todas iguales). */
export const PANE_WINDOW_VIEWPORT_RATIO = 0.7

/** Mini terminal / preview en el plano (tamaño base ~1280×800). */
export const PLANE_MINI_WINDOW_WIDTH = 200
/** Altura base de la card mini de agente (face min-height 82 + border 2). */
export const PLANE_MINI_AGENT_BASE_HEIGHT = 84
/** Mini terminal: titlebar + preview; un poco más alta que agente base. */
export const PLANE_MINI_TERMINAL_HEIGHT = 104
/** Fallback de altura mini terminal (ranura y morph). */
export const PLANE_MINI_WINDOW_HEIGHT = PLANE_MINI_TERMINAL_HEIGHT

/** Tope al crecer en pantallas muy anchas/altas (ancho contenido a propósito). */
export const PLANE_MINI_MAX_WIDTH = 230
export const PLANE_MINI_MAX_HEIGHT = 300
/** Ancho mínimo de mini cuando el viewport no alcanza el tamaño base. */
export const PLANE_MINI_MIN_WIDTH = 148

/** Padding superior / gap / hueco inferior (composer) para empaquetar la columna. */
export const PLANE_MINI_SLOT_PAD_Y = 72
export const PLANE_MINI_SLOT_GAP = 20
/** Hueco inferior columna terminales (FAB izquierdo + margen). */
export const PLANE_MINI_BOTTOM_CLEARANCE = 96
/** Hueco inferior columna agentes (FAB derecho 68px + escala mini + chrome half-out). */
export const PLANE_MINI_AGENT_BOTTOM_CLEARANCE = 104
/** Padding horizontal mínimo (referencia ~1280px). */
export const PLANE_MINI_SLOT_PAD_X = 28
/** Tope de padding exterior en pantallas muy anchas. */
export const PLANE_MINI_SLOT_PAD_X_MAX = 112

/** Columna central de chat (composer + stream): base ~1280px de viewport. */
export const PLANE_CHAT_BASE_WIDTH = 640
export const PLANE_CHAT_MAX_WIDTH = 960
/** Holgura entre minis laterales y la columna de chat. */
export const PLANE_CHAT_SIDE_GAP = 24

/**
 * Reserva izquierda para tools rail (`TabAgenticPlane.css`: inset 8 + rail ~36 + holgura).
 * Alineado con `--plane-tools-rail-inset` + ancho de `.plane-tools-rail`.
 */
export const PLANE_TOOLS_RAIL_RESERVE = 52
/**
 * Reserva derecha para context pool (`PlaneContextPool.css`: inset 8 + rail ~36 + holgura).
 */
export const PLANE_CONTEXT_POOL_RESERVE = 52
/** Ancho mínimo legible de la columna de chat en viewports estrechos. */
export const PLANE_CHAT_MIN_WIDTH = 320
/** Sin tilt 3D en columnas por debajo de este ancho (alineado con @container 1040px). */
export const PLANE_COLUMN_TILT_BREAKPOINT = 1040
/** Tilt 3D de columnas laterales en viewports anchos. */
export const PLANE_COLUMN_TILT_DEG = 10

export interface PlaneMiniColumnLayout {
  chatWidth: number
  chatLeft: number
  terminalX: number
  agentX: number
  cell: { width: number; height: number }
}

function planeMiniSidesReserve(cellWidth: number): number {
  return (
    PLANE_TOOLS_RAIL_RESERVE
    + cellWidth
    + PLANE_CHAT_SIDE_GAP
    + PLANE_CONTEXT_POOL_RESERVE
    + cellWidth
    + PLANE_CHAT_SIDE_GAP
  )
}

/**
 * Ranura mini según viewport: crece en pantallas grandes y se encoge
 * si la columna tiene muchos ítems (sin bajar del tamaño base).
 */
export function computePlaneMiniSlotCell(
  viewport: { width: number; height: number },
  columnCount = 1,
): { width: number; height: number } {
  const vw = Math.max(viewport.width, 320)
  const vh = Math.max(viewport.height, 240)
  const n = Math.max(1, Math.floor(columnCount))

  // Ancho: crece más lento que el viewport (0.4× el exceso) para no verse demasiado ancho.
  const widthScale = 1 + Math.max(0, vw / 1280 - 1) * 0.4
  const widthFromScale = Math.round(Math.min(
    PLANE_MINI_MAX_WIDTH,
    Math.max(PLANE_MINI_WINDOW_WIDTH, PLANE_MINI_WINDOW_WIDTH * widthScale),
  ))
  const sidesFixed = (
    PLANE_TOOLS_RAIL_RESERVE
    + PLANE_CONTEXT_POOL_RESERVE
    + 2 * PLANE_CHAT_SIDE_GAP
    + PLANE_CHAT_MIN_WIDTH
  )
  const maxCellFromViewport = Math.floor((vw - sidesFixed) / 2)
  const width = Math.round(Math.min(
    widthFromScale,
    Math.max(PLANE_MINI_MIN_WIDTH, maxCellFromViewport),
  ))

  const heightFromScale = Math.round(Math.min(
    PLANE_MINI_MAX_HEIGHT,
    Math.max(PLANE_MINI_WINDOW_HEIGHT, PLANE_MINI_WINDOW_HEIGHT * (vh / 800)),
  ))
  const availableH = vh - PLANE_MINI_SLOT_PAD_Y - PLANE_MINI_BOTTOM_CLEARANCE
  const heightFromFit = Math.floor((availableH - (n - 1) * PLANE_MINI_SLOT_GAP) / n)
  const height = Math.max(
    PLANE_MINI_WINDOW_HEIGHT,
    Math.min(heightFromScale, Math.max(PLANE_MINI_WINDOW_HEIGHT, heightFromFit)),
  )

  return { width, height }
}

/**
 * Ancho de la columna de chat: crece con el viewport sin invadir las minis laterales.
 */
export function computePlaneChatColumnWidth(
  viewport: { width: number; height: number },
  columnCount = 1,
): number {
  return computePlaneMiniColumnLayout(viewport, columnCount).chatWidth
}

/**
 * Layout horizontal del plano: chat centrado y minis centradas en la banda lateral
 * (tools rail / context pool), sin acercarse al centro en viewports anchos.
 */
export function computePlaneMiniColumnLayout(
  viewport: { width: number; height: number },
  columnCount = 1,
): PlaneMiniColumnLayout {
  const vw = Math.max(viewport.width, 320)
  const n = Math.max(1, Math.floor(columnCount))
  const cell = computePlaneMiniSlotCell(viewport, n)
  const sidesReserve = planeMiniSidesReserve(cell.width)
  const available = Math.max(0, vw - sidesReserve)
  const scaled = Math.round(PLANE_CHAT_BASE_WIDTH * (vw / 1280))
  const target = Math.min(PLANE_CHAT_MAX_WIDTH, scaled)
  const chatWidth = available < PLANE_CHAT_MIN_WIDTH
    ? Math.round(available)
    : Math.round(Math.min(
      PLANE_CHAT_MAX_WIDTH,
      Math.max(PLANE_CHAT_MIN_WIDTH, Math.min(target, available)),
    ))
  const chatLeft = Math.floor((vw - chatWidth) / 2)
  const chatRight = chatLeft + chatWidth
  const agentSlotWidth = Math.max(cell.width, PLANE_MINI_AGENT_WIDTH)

  const leftBandStart = PLANE_TOOLS_RAIL_RESERVE
  const leftBandEnd = chatLeft - PLANE_CHAT_SIDE_GAP
  const leftBandCenter = (leftBandStart + leftBandEnd) / 2
  const terminalXIdeal = Math.round(leftBandCenter - cell.width / 2)
  const terminalX = Math.max(
    leftBandStart,
    Math.min(terminalXIdeal, leftBandEnd - cell.width),
  )

  const rightBandStart = chatRight + PLANE_CHAT_SIDE_GAP
  const rightBandEnd = vw - PLANE_CONTEXT_POOL_RESERVE
  const rightBandCenter = (rightBandStart + rightBandEnd) / 2
  const agentXIdeal = Math.round(rightBandCenter - agentSlotWidth / 2)
  const agentX = Math.max(
    rightBandStart,
    Math.min(agentXIdeal, rightBandEnd - agentSlotWidth),
  )

  return {
    chatWidth,
    chatLeft,
    terminalX,
    agentX,
    cell,
  }
}

/**
 * X de la columna de terminales (compat: antes era padding simétrico blended).
 */
export function computePlaneMiniSlotPadX(
  viewport: { width: number; height: number },
  columnCount = 1,
): number {
  return computePlaneMiniColumnLayout(viewport, columnCount).terminalX
}

/** Tilt 3D de columnas; 0 en viewports estrechos para evitar solapamiento visual. */
export function computePlaneColumnTiltDeg(viewportWidth: number): number {
  const vw = Math.max(viewportWidth, 320)
  if (vw <= PLANE_COLUMN_TILT_BREAKPOINT) return 0
  return PLANE_COLUMN_TILT_DEG
}

/**
 * Desplazamiento máximo de scroll de una columna del plano.
 * 0 si el contenido (más el hueco inferior del composer) cabe en el viewport.
 */
export function clampPlaneColumnScroll(
  contentHeight: number,
  viewportHeight: number,
): number {
  return Math.max(0, contentHeight + PLANE_MINI_BOTTOM_CLEARANCE - viewportHeight)
}

/** Fallback de ranura mini (runtime: computePlaneMiniSlotCell). */
export const PLANE_MINI_AGENT_WIDTH = PLANE_MINI_WINDOW_WIDTH
export const PLANE_MINI_AGENT_HEIGHT = PLANE_MINI_AGENT_BASE_HEIGHT
export const PLANE_MINI_TITLEBAR_HEIGHT = 26
/** Tamaño del ícono de contexto en la grilla mini (`.plane-context-card`). */
export const PLANE_MINI_AGENT_CONTEXT_ICON_SIZE = 18
/** Gap horizontal entre íconos en la grilla. */
export const PLANE_MINI_AGENT_CONTEXT_COL_GAP = 6
/** Padding horizontal de `.plane-mini-face` (10px izq + 10px der). */
export const PLANE_MINI_AGENT_FACE_PAD_X = 20
/** Altura de cada fila de contexto (ícono 18px). */
export const PLANE_MINI_AGENT_CONTEXT_ROW_HEIGHT = PLANE_MINI_AGENT_CONTEXT_ICON_SIZE
/** Hueco único entre secciones de la mini (`--plane-mini-face-section-gap`). */
export const PLANE_MINI_AGENT_CONTEXT_SECTION_HEIGHT = 4
/** Gap vertical entre filas de la grilla de contextos en la mini. */
export const PLANE_MINI_AGENT_CONTEXT_ROW_GAP = 4

/** Cuántos íconos caben por fila según el ancho de la mini del agente. */
export function computePlaneAgentContextIconsPerRow(cellWidth: number): number {
  const available = Math.max(
    0,
    Math.floor(cellWidth) - PLANE_MINI_AGENT_FACE_PAD_X,
  )
  if (available < PLANE_MINI_AGENT_CONTEXT_ICON_SIZE) return 1
  const stride = PLANE_MINI_AGENT_CONTEXT_ICON_SIZE + PLANE_MINI_AGENT_CONTEXT_COL_GAP
  return Math.max(
    1,
    Math.floor((available + PLANE_MINI_AGENT_CONTEXT_COL_GAP) / stride),
  )
}

/** Altura de la grilla de contextos según cantidad de íconos. */
export function estimatePlaneAgentContextGridHeight(
  contextCount: number,
  iconsPerRow: number,
): number {
  const n = Math.max(0, Math.floor(contextCount))
  const perRow = Math.max(1, Math.floor(iconsPerRow))
  if (n === 0) return 0
  const rows = Math.ceil(n / perRow)
  return rows * PLANE_MINI_AGENT_CONTEXT_ROW_HEIGHT
    + Math.max(0, rows - 1) * PLANE_MINI_AGENT_CONTEXT_ROW_GAP
}

/** offsetHeight = border-box local; no usar getBoundingClientRect (tilt 3D de la columna). */
export function readPlaneMiniAgentLayoutHeight(el: HTMLElement): number {
  return Math.max(0, el.offsetHeight)
}

/** Altura de mini agente según contextos (primer frame, antes del ResizeObserver). */
export function estimatePlaneAgentMiniHeight(
  contextCount: number,
  cellWidth = PLANE_MINI_WINDOW_WIDTH,
): number {
  const n = Math.max(0, Math.floor(contextCount))
  if (n === 0) return PLANE_MINI_AGENT_BASE_HEIGHT
  const iconsPerRow = computePlaneAgentContextIconsPerRow(cellWidth)
  // padding-y 8+10, header 22, status ~17, y el mismo hueco de sección entre header/estado
  // y entre estado/nodos. No modela el hueco inputs↔results: el RO lo corrige.
  const content = 8 + 22 + PLANE_MINI_AGENT_CONTEXT_SECTION_HEIGHT + 17
    + PLANE_MINI_AGENT_CONTEXT_SECTION_HEIGHT
    + estimatePlaneAgentContextGridHeight(n, iconsPerRow)
    + 10
  return Math.max(
    PLANE_MINI_AGENT_BASE_HEIGHT,
    2 + Math.max(82, content),
  )
}

/** Geometría de layout en runtime (no se persiste). */
export type PaneWindowGeometry = {
  x: number
  y: number
  width: number
  height: number
}

export function maxPaneWindowZ(windows: Record<string, PaneWindowState> | undefined): number {
  if (!windows) return 0
  let max = 0
  for (const win of Object.values(windows)) {
    if (win.zIndex > max) max = win.zIndex
  }
  return max
}

/** Minimiza todas las ventanas excepto `keepPaneId` (una sola abierta a la vez). */
export function minimizeOtherPaneWindows(
  paneIds: string[],
  windows: Record<string, PaneWindowState>,
  keepPaneId: string,
): void {
  for (const id of paneIds) {
    if (id === keepPaneId) continue
    const other = windows[id]
    if (!other) continue
    if (other.open || other.fullscreen) {
      windows[id] = { ...other, open: false, fullscreen: false }
    }
  }
}

/** Ventana abierta: ~70% del viewport, un poco por encima del centro. */
export function computeStandardPaneWindowGeometry(
  viewport: { width: number; height: number },
): PaneWindowGeometry {
  const vw = Math.max(viewport.width, PANE_WINDOW_MIN_WIDTH + 32)
  const vh = Math.max(viewport.height, PANE_WINDOW_MIN_HEIGHT + 64)
  const width = Math.max(
    PANE_WINDOW_MIN_WIDTH,
    Math.min(Math.round(vw * PANE_WINDOW_VIEWPORT_RATIO), vw - 32),
  )
  const height = Math.max(
    PANE_WINDOW_MIN_HEIGHT,
    Math.min(Math.round(vh * PANE_WINDOW_VIEWPORT_RATIO), vh - 64),
  )
  const centeredY = Math.round((vh - height) / 2)
  // Subir un poco respecto al centro (composer abajo).
  const y = Math.max(16, centeredY - Math.round(vh * 0.04))
  return {
    x: Math.max(16, Math.round((vw - width) / 2)),
    y,
    width,
    height,
  }
}

/** Estado persistido de ventana (sin x/y/width/height). */
export function createPaneWindowState(
  existing: Record<string, PaneWindowState> | undefined,
  open = false,
): PaneWindowState {
  return {
    open,
    fullscreen: false,
    zIndex: maxPaneWindowZ(existing) + 1,
  }
}

export function sanitizePaneWindowState(
  raw: Partial<PaneWindowState> & {
    x?: number
    y?: number
    width?: number
    height?: number
  } | undefined,
  fallbackZ: number,
): PaneWindowState {
  const zIndex = typeof raw?.zIndex === 'number' && Number.isFinite(raw.zIndex)
    ? Math.max(1, Math.floor(raw.zIndex))
    : fallbackZ
  return {
    // Default cerrado: solo `open: true` explícito cuenta (evita expandir por undefined).
    open: raw?.open === true,
    fullscreen: raw?.fullscreen === true,
    zIndex,
  }
}

/** Fuerza todas las ventanas a mini (p. ej. al restaurar sesión). */
export function collapseAllPaneWindows(
  windows: Record<string, PaneWindowState> | undefined,
): Record<string, PaneWindowState> | undefined {
  if (!windows) return undefined
  const next: Record<string, PaneWindowState> = {}
  for (const [id, win] of Object.entries(windows)) {
    next[id] = { ...win, open: false, fullscreen: false }
  }
  return next
}

/**
 * Si faltan `paneWindows`, genera entradas (migración desde split).
 * Las entradas nuevas quedan cerradas (`open: false`).
 */
export function ensurePaneWindows(
  paneIds: string[],
  existing: Record<string, PaneWindowState> | undefined,
): Record<string, PaneWindowState> | undefined {
  if (paneIds.length === 0) return undefined
  const next: Record<string, PaneWindowState> = {}
  let z = 1
  for (const paneId of paneIds) {
    const raw = existing?.[paneId]
    if (raw) {
      next[paneId] = sanitizePaneWindowState(raw, z)
    } else {
      next[paneId] = {
        open: false,
        fullscreen: false,
        zIndex: z,
      }
    }
    z += 1
  }
  return next
}

/** Rellena `paneWindows` faltantes; descarta posiciones libres legacy del mapa 2D. */
export function ensureTabPaneLayout<T extends {
  paneIds: string[]
  paneWindows?: Record<string, PaneWindowState>
  panePlaneNodes?: unknown
}>(tab: T): Omit<T, 'panePlaneNodes'> & {
  paneWindows?: Record<string, PaneWindowState>
} {
  const paneWindows = ensurePaneWindows(tab.paneIds, tab.paneWindows)
  const { panePlaneNodes: _legacy, ...rest } = tab
  return {
    ...rest,
    ...(paneWindows ? { paneWindows } : { paneWindows: undefined }),
  }
}
