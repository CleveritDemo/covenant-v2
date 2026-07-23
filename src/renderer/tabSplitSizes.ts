import type { TabSplitSizes } from '../shared/tabSession'

export type { TabSplitSizes }

export const DEFAULT_COLUMN_RATIO = 0.5
export const DEFAULT_ROW_RATIO = 0.5

const STATIC_MIN = 0.15
const STATIC_MAX = 0.85

export function getDefaultSplitSizes(paneCount: number): TabSplitSizes | undefined {
  if (paneCount <= 1) return undefined
  return {
    columnRatio: DEFAULT_COLUMN_RATIO,
    rowRatio: paneCount >= 3 ? DEFAULT_ROW_RATIO : undefined,
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
