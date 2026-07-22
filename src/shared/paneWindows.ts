import type { PaneWindowState } from '@shared/tabSession'

export const PANE_WINDOW_MIN_WIDTH = 320
export const PANE_WINDOW_MIN_HEIGHT = 200
/** Fracción del viewport del plano para ventanas abiertas (todas iguales). */
export const PANE_WINDOW_VIEWPORT_RATIO = 0.7

/** Mini terminal / preview en el plano (tamaño base ~1280×800). */
export const PLANE_MINI_WINDOW_WIDTH = 200
export const PLANE_MINI_WINDOW_HEIGHT = 130

/** Tope al crecer en pantallas muy anchas/altas (ancho contenido a propósito). */
export const PLANE_MINI_MAX_WIDTH = 230
export const PLANE_MINI_MAX_HEIGHT = 300

/** Padding superior / gap / hueco inferior (composer) para empaquetar la columna. */
export const PLANE_MINI_SLOT_PAD_Y = 72
export const PLANE_MINI_SLOT_GAP = 20
export const PLANE_MINI_BOTTOM_CLEARANCE = 148
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
  const width = Math.round(Math.min(
    PLANE_MINI_MAX_WIDTH,
    Math.max(PLANE_MINI_WINDOW_WIDTH, PLANE_MINI_WINDOW_WIDTH * widthScale),
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
  const vw = Math.max(viewport.width, 320)
  const side = computePlaneMiniSlotCell(viewport, columnCount)
  const sidesReserve = 2 * (PLANE_MINI_SLOT_PAD_X + side.width + PLANE_CHAT_SIDE_GAP)
  const available = Math.max(PLANE_CHAT_BASE_WIDTH, vw - sidesReserve)
  const scaled = Math.round(PLANE_CHAT_BASE_WIDTH * (vw / 1280))
  return Math.round(Math.min(
    PLANE_CHAT_MAX_WIDTH,
    Math.max(PLANE_CHAT_BASE_WIDTH, Math.min(scaled, available)),
  ))
}

/**
 * Padding exterior de columnas: terminales a la izquierda, agentes a la derecha.
 * Solo crece con el sobrante respecto al layout de referencia (~1280px), hasta un tope.
 */
export function computePlaneMiniSlotPadX(
  viewport: { width: number; height: number },
  columnCount = 1,
): number {
  const vw = Math.max(viewport.width, 320)
  const cell = computePlaneMiniSlotCell(viewport, columnCount)
  const chat = computePlaneChatColumnWidth(viewport, columnCount)
  const freePerSide = Math.max(
    0,
    Math.floor((vw - chat - 2 * (cell.width + PLANE_CHAT_SIDE_GAP)) / 2),
  )

  const refCell = computePlaneMiniSlotCell({ width: 1280, height: 800 }, 1)
  const refFreePerSide = Math.max(
    0,
    Math.floor(
      (1280 - PLANE_CHAT_BASE_WIDTH - 2 * (refCell.width + PLANE_CHAT_SIDE_GAP)) / 2,
    ),
  )
  const extra = Math.max(0, freePerSide - refFreePerSide)
  return Math.min(
    PLANE_MINI_SLOT_PAD_X_MAX,
    Math.max(PLANE_MINI_SLOT_PAD_X, PLANE_MINI_SLOT_PAD_X + extra),
  )
}

/**
 * Letterbox del openGeometry en una ranura (legacy; minis usan la ranura completa).
 */
export function computePlaneMiniLetterboxSize(
  open: { width: number; height: number },
  slotW = PLANE_MINI_WINDOW_WIDTH,
  slotH = PLANE_MINI_WINDOW_HEIGHT,
): { width: number; height: number } {
  const scale = Math.min(
    slotW / Math.max(open.width, 1),
    slotH / Math.max(open.height, 1),
  )
  return {
    width: Math.max(1, Math.round(open.width * scale)),
    height: Math.max(1, Math.round(open.height * scale)),
  }
}

/** Fallback de ranura mini (runtime: computePlaneMiniSlotCell). */
export const PLANE_MINI_AGENT_WIDTH = PLANE_MINI_WINDOW_WIDTH
export const PLANE_MINI_AGENT_HEIGHT = PLANE_MINI_WINDOW_HEIGHT
export const PLANE_MINI_TITLEBAR_HEIGHT = 26

/** Altura base de la card mini de agente (sin contextos). */
export const PLANE_MINI_AGENT_BASE_HEIGHT = 64
/** Altura de cada fila de contexto (ícono + nombre). */
export const PLANE_MINI_AGENT_CONTEXT_ROW_HEIGHT = 14
/** Chrome de la sección de contextos (borde + padding). */
export const PLANE_MINI_AGENT_CONTEXT_SECTION_HEIGHT = 7

/** Altura de mini agente según cantidad de contextos asignados. */
export function estimatePlaneAgentMiniHeight(contextCount: number): number {
  const n = Math.max(0, Math.floor(contextCount))
  if (n === 0) return PLANE_MINI_AGENT_BASE_HEIGHT
  return (
    PLANE_MINI_AGENT_BASE_HEIGHT
    + PLANE_MINI_AGENT_CONTEXT_SECTION_HEIGHT
    + n * PLANE_MINI_AGENT_CONTEXT_ROW_HEIGHT
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
