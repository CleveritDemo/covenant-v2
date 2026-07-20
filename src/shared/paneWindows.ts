import type { PaneWindowState } from '@shared/tabSession'

export const PANE_WINDOW_MIN_WIDTH = 320
export const PANE_WINDOW_MIN_HEIGHT = 200
/** Fracción del viewport del plano para ventanas abiertas (todas iguales). */
export const PANE_WINDOW_VIEWPORT_RATIO = 0.7

/** Mini terminal / preview en el plano (~4 caben en altura típica). */
export const PLANE_MINI_WINDOW_WIDTH = 174
export const PLANE_MINI_WINDOW_HEIGHT = 128

/**
 * Footprint visual de una terminal mini (letterbox del openGeometry en la ranura).
 * Los contenedores de agente deben usar este tamaño, no el de la ranura completa.
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

/** Fallback; en runtime el agente usa computePlaneMiniLetterboxSize. */
export const PLANE_MINI_AGENT_WIDTH = PLANE_MINI_WINDOW_WIDTH
export const PLANE_MINI_AGENT_HEIGHT = PLANE_MINI_WINDOW_HEIGHT
export const PLANE_MINI_TITLEBAR_HEIGHT = 26

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
