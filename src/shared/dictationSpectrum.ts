/** Bandas log-espaciadas emitidas por el helper macOS (Goertzel). */
export const DICTATION_SPECTRUM_BAND_COUNT = 12

export type DictationLevelPayload = {
  peak: number
  bands: number[]
}

function clampBand(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

export function emptyDictationBands(): number[] {
  return Array.from({ length: DICTATION_SPECTRUM_BAND_COUNT }, () => 0)
}

export function normalizeDictationBands(raw: unknown): number[] {
  if (!Array.isArray(raw)) return emptyDictationBands()
  return Array.from({ length: DICTATION_SPECTRUM_BAND_COUNT }, (_, index) => (
    clampBand(raw[index])
  ))
}

export function normalizeDictationLevelPayload(raw: unknown): DictationLevelPayload | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { peak: clampBand(raw), bands: emptyDictationBands() }
  }
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (typeof data.peak !== 'number' || !Number.isFinite(data.peak)) return null
  return {
    peak: clampBand(data.peak),
    bands: normalizeDictationBands(data.bands),
  }
}

/** Respaldo cuando el backend aún no emite bandas (Win/Linux o helper viejo). */
export function synthesizeDictationBands(level: number, seed: number): number[] {
  const clamped = clampBand(level)
  if (clamped <= 0.01) return emptyDictationBands()
  return Array.from({ length: DICTATION_SPECTRUM_BAND_COUNT }, (_, index) => {
    const weight = 0.55 + 0.45 * Math.sin((index + seed) * 0.9)
    const bias = 1 - Math.abs(index - 4) * 0.08
    return clampBand(clamped * weight * bias * 1.15)
  })
}
