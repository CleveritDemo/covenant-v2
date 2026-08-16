import {
  DICTATION_SPECTRUM_BAND_COUNT,
  normalizeDictationBands,
  synthesizeDictationBands,
} from '../../shared/dictationSpectrum'

/** @deprecated Usar dictationMicSpectrumBands (12 bandas). Mantener para tests legacy. */
export const DICTATION_MIC_BAR_COUNT = 6

/** Barras visibles en el botón mic (menos densas = más legibles). */
export const DICTATION_MIC_VISUAL_BAR_COUNT = 7

/** Energías 0–1 por barra visual del botón mic (bass→treble). */
export function dictationMicBarEnergies(bands: number[], level: number): number[] {
  const spectrum = dictationMicSpectrumBands(bands, level)
  return Array.from({ length: DICTATION_MIC_BAR_COUNT }, (_, index) => {
    const start = Math.floor((index / DICTATION_MIC_BAR_COUNT) * DICTATION_SPECTRUM_BAND_COUNT)
    const end = Math.floor(((index + 1) / DICTATION_MIC_BAR_COUNT) * DICTATION_SPECTRUM_BAND_COUNT)
    let peak = 0
    for (let band = start; band < end; band += 1) {
      peak = Math.max(peak, spectrum[band] ?? 0)
    }
    return peak
  })
}

/** Bandas agregadas para el mini ecualizador del botón. */
export function dictationMicVisualBars(bands: number[], level: number): number[] {
  const spectrum = dictationMicSpectrumBands(bands, level)
  return Array.from({ length: DICTATION_MIC_VISUAL_BAR_COUNT }, (_, index) => {
    const start = Math.floor((index / DICTATION_MIC_VISUAL_BAR_COUNT) * DICTATION_SPECTRUM_BAND_COUNT)
    const end = Math.floor(((index + 1) / DICTATION_MIC_VISUAL_BAR_COUNT) * DICTATION_SPECTRUM_BAND_COUNT)
    let peak = 0
    for (let band = start; band < end; band += 1) {
      peak = Math.max(peak, spectrum[band] ?? 0)
    }
    return peak
  })
}

/** Bandas 0–1 listas para el visualizador (12 barras finas). */
export function dictationMicSpectrumBands(bands: number[], level: number): number[] {
  const clamped = Math.min(1, Math.max(0, level))
  const normalized = bands.length === DICTATION_SPECTRUM_BAND_COUNT
    ? bands.map(value => Math.min(1, Math.max(0, value)))
    : normalizeDictationBands(bands)
  const hasBands = normalized.some(value => value >= 0.012)
  const raw = hasBands
    ? normalized.map(value => Math.min(1, value * 1.9))
    : synthesizeDictationBands(clamped, 0).map(value => Math.min(1, value * 1.9))

  if (clamped < 0.008) return raw

  return raw.map(value => Math.max(value, 0.04))
}

export function dictationMicButtonStyle(
  level: number,
  bands: number[],
): Record<string, string> {
  const clamped = Math.min(1, Math.max(0, level))
  const spectrum = dictationMicSpectrumBands(bands, clamped)
  const style: Record<string, string> = {
    '--dictation-level': String(clamped),
  }
  for (let index = 0; index < DICTATION_SPECTRUM_BAND_COUNT; index += 1) {
    style[`--dictation-band-${index + 1}`] = String(spectrum[index] ?? 0)
  }
  return style
}
