import type { TabSplitSizes } from '../shared/tabSession'

export type { TabSplitSizes }

export const DEFAULT_COLUMN_RATIO = 0.5
export const DEFAULT_ROW_RATIO = 0.5
export const SPLIT_GUTTER_PX = 3
export const MIN_PANE_WIDTH_PX = 120
export const MIN_PANE_HEIGHT_PX = 80
/** Columna del agente cuando comparte pestaña con una terminal. */
export const AGENT_PRIORITY_COLUMN_RATIO = 0.64

const STATIC_MIN = 0.15
const STATIC_MAX = 0.85

export function getDefaultSplitSizes(paneCount: number): TabSplitSizes | undefined {
  if (paneCount <= 1) return undefined
  return {
    columnRatio: DEFAULT_COLUMN_RATIO,
    rowRatio: paneCount >= 3 ? DEFAULT_ROW_RATIO : undefined,
  }
}

/** Al añadir un panel, conserva ratios ya ajustados (p. ej. rowRatio 3→4). */
export function splitSizesAfterAddingPane(
  tab: { paneIds: string[]; splitSizes?: TabSplitSizes },
  nextPaneCount: number,
): TabSplitSizes | undefined {
  const defaults = getDefaultSplitSizes(nextPaneCount)
  if (!defaults) return undefined

  const prev = normalizeSplitSizes(tab)
  if (!prev) return defaults

  return {
    columnRatio: prev.columnRatio,
    rowRatio: nextPaneCount >= 3 ? (prev.rowRatio ?? defaults.rowRatio) : undefined,
  }
}

/**
 * Preferencia de espacio: el agente ocupa ~64% frente a una terminal.
 * Solo aplica con exactamente 2 paneles y un único agente.
 */
export function columnRatioForAgentPriority(
  paneIds: string[],
  paneKinds?: Record<string, string>,
): number {
  if (paneIds.length !== 2) return DEFAULT_COLUMN_RATIO
  const left = paneIds[0]!
  const right = paneIds[1]!
  const leftAgent = paneKinds?.[left] === 'agent'
  const rightAgent = paneKinds?.[right] === 'agent'
  if (leftAgent && !rightAgent) return AGENT_PRIORITY_COLUMN_RATIO
  if (!leftAgent && rightAgent) return 1 - AGENT_PRIORITY_COLUMN_RATIO
  return DEFAULT_COLUMN_RATIO
}

/** Ratios tras añadir panel, favoreciendo al agente si hay mezcla 1+1. */
export function splitSizesAfterAddingPanePreferAgent(
  tab: { paneIds: string[]; splitSizes?: TabSplitSizes; paneKinds?: Record<string, string> },
  nextPaneIds: string[],
  nextPaneKinds?: Record<string, string>,
): TabSplitSizes | undefined {
  const base = splitSizesAfterAddingPane(tab, nextPaneIds.length)
  if (!base) return undefined
  if (nextPaneIds.length !== 2) return base
  const kinds = nextPaneKinds ?? tab.paneKinds
  const hadExplicit =
    tab.splitSizes != null &&
    Number.isFinite(tab.splitSizes.columnRatio) &&
    tab.paneIds.length >= 2
  if (hadExplicit) return base
  return {
    ...base,
    columnRatio: columnRatioForAgentPriority(nextPaneIds, kinds),
  }
}

function clampRatioStatic(r: number, fallback: number): number {
  if (!Number.isFinite(r)) return fallback
  return Math.min(STATIC_MAX, Math.max(STATIC_MIN, r))
}

/** Normaliza ratios guardados; devuelve undefined si la pestaña tiene un solo panel. */
export function normalizeSplitSizes(tab: {
  paneIds: string[]
  splitSizes?: TabSplitSizes
}): TabSplitSizes | undefined {
  const n = tab.paneIds.length
  if (n <= 1) return undefined
  const defaults = getDefaultSplitSizes(n)!
  const s = tab.splitSizes
  const columnRatio = clampRatioStatic(s?.columnRatio ?? defaults.columnRatio, DEFAULT_COLUMN_RATIO)
  const rowRatio =
    n >= 3
      ? clampRatioStatic(s?.rowRatio ?? defaults.rowRatio ?? DEFAULT_ROW_RATIO, DEFAULT_ROW_RATIO)
      : undefined
  return { columnRatio, rowRatio }
}

export function normalizeTabSession<T extends { paneIds: string[]; splitSizes?: TabSplitSizes }>(
  tab: T,
): T {
  const splitSizes = normalizeSplitSizes(tab)
  if (!splitSizes) {
    const { splitSizes: _removed, ...rest } = tab
    return rest as T
  }
  return { ...tab, splitSizes }
}

export function clampColumnRatio(ratio: number, containerWidth: number): number {
  const available = containerWidth - SPLIT_GUTTER_PX
  if (available <= MIN_PANE_WIDTH_PX * 2) return DEFAULT_COLUMN_RATIO
  const minR = MIN_PANE_WIDTH_PX / available
  const maxR = 1 - minR
  return Math.min(maxR, Math.max(minR, ratio))
}

export function clampRowRatio(ratio: number, containerHeight: number): number {
  const available = containerHeight - SPLIT_GUTTER_PX
  if (available <= MIN_PANE_HEIGHT_PX * 2) return DEFAULT_ROW_RATIO
  const minR = MIN_PANE_HEIGHT_PX / available
  const maxR = 1 - minR
  return Math.min(maxR, Math.max(minR, ratio))
}

export function columnGridTemplate(ratio: number): string {
  const r = clampRatioStatic(ratio, DEFAULT_COLUMN_RATIO)
  const pct = (r * 100).toFixed(3)
  // Columna derecha siempre `1fr` para ocupar el resto tras el gutter (evita hueco negro).
  return `minmax(${MIN_PANE_WIDTH_PX}px, ${pct}%) ${SPLIT_GUTTER_PX}px minmax(${MIN_PANE_WIDTH_PX}px, 1fr)`
}

export function rowGridTemplate(ratio: number): string {
  const r = clampRatioStatic(ratio, DEFAULT_ROW_RATIO)
  const topFr = Math.max(0.001, r)
  const bottomFr = Math.max(0.001, 1 - r)
  return `minmax(${MIN_PANE_HEIGHT_PX}px, ${topFr}fr) ${SPLIT_GUTTER_PX}px minmax(${MIN_PANE_HEIGHT_PX}px, ${bottomFr}fr)`
}
