import { describe, expect, it } from 'vitest'
import {
  THEMES,
  computePlaneGridLineRgb,
  computePlaneGridOpacity,
  computePlaneGridWarmth,
  getTheme,
  planeGridTargetContrast,
  type AppTheme,
} from '../presets'

function gridContrast(
  bg: string,
  opacity: number,
  light: boolean,
): number {
  function parseHex(s: string): [number, number, number] | null {
    const m = /^#([0-9a-f]{6})$/i.exec(s.trim())
    if (!m) return null
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  function lum([r, g, b]: [number, number, number]): number {
    const lin = (v: number): number => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const bgRgb = parseHex(bg)!
  const lineRgb: [number, number, number] = light ? [0, 0, 0] : [255, 255, 255]
  const bgL = lum(bgRgb)
  const lineL = lum(lineRgb)
  // Factor compuesto histórico (PLANE_GRID_LINE_ALPHA).
  const alpha = opacity * 0.73
  const blended = bgL * (1 - alpha) + lineL * alpha
  const hi = Math.max(blended, bgL)
  const lo = Math.min(blended, bgL)
  return (hi + 0.05) / (lo + 0.05)
}

function themeGridContrast(theme: AppTheme): number {
  return gridContrast(
    theme.vars['--bg']!,
    computePlaneGridOpacity(theme),
    theme.appearance === 'light',
  )
}

describe('computePlaneGridOpacity', () => {
  it('mantiene la opacidad de referencia en Interstellar', () => {
    expect(computePlaneGridOpacity(getTheme('interstellar'))).toBe(0.059)
  })

  it('mantiene la opacidad de referencia en Interstellar Light', () => {
    expect(computePlaneGridOpacity(getTheme('interstellarLight'))).toBe(0.048)
  })

  it('alinea el contraste de los temas oscuros al de Interstellar', () => {
    const target = themeGridContrast(getTheme('interstellar'))
    for (const theme of THEMES.filter(t => t.appearance !== 'light')) {
      // Paso de búsqueda 0.002: con línea blanca el residual puede pasar de 0.005.
      expect(themeGridContrast(theme)).toBeCloseTo(target, 1)
    }
  })

  it('calibra el contraste de los temas claros con notoriedad reducida', () => {
    const target = planeGridTargetContrast(true)
    for (const theme of THEMES.filter(t => t.appearance === 'light')) {
      const ratio = themeGridContrast(theme)
      const opacity = computePlaneGridOpacity(theme)
      if (opacity >= 0.99) {
        // Fondo muy cercano al negro de línea: opacidad al tope.
        expect(ratio).toBeLessThanOrEqual(target + 0.02)
      } else {
        expect(ratio).toBeCloseTo(target, 2)
      }
    }
  })

  it('temas claros calibran a un contraste más bajo que el ancla oscura', () => {
    const darkContrast = themeGridContrast(getTheme('interstellar'))
    const lightContrast = themeGridContrast(getTheme('interstellarLight'))
    expect(lightContrast).toBeLessThan(darkContrast)
  })

  it('cada apariencia usa su propio ancla de contraste', () => {
    expect(planeGridTargetContrast(false)).toBeCloseTo(themeGridContrast(getTheme('interstellar')), 1)
    expect(planeGridTargetContrast(true)).toBeCloseTo(themeGridContrast(getTheme('interstellarLight')), 1)
  })
})

describe('computePlaneGridLineRgb', () => {
  it('usa blanco en temas oscuros', () => {
    expect(computePlaneGridLineRgb(getTheme('interstellar'))).toBe('rgb(255, 255, 255)')
  })

  it('usa negro en temas claros', () => {
    expect(computePlaneGridLineRgb(getTheme('interstellarLight'))).toBe('rgb(0, 0, 0)')
  })

  it('no tiñe por accent: mismo rgb en todos los oscuros y todos los claros', () => {
    for (const theme of THEMES.filter(t => t.appearance !== 'light')) {
      expect(computePlaneGridLineRgb(theme)).toBe('rgb(255, 255, 255)')
    }
    for (const theme of THEMES.filter(t => t.appearance === 'light')) {
      expect(computePlaneGridLineRgb(theme)).toBe('rgb(0, 0, 0)')
    }
  })
})

describe('computePlaneGridWarmth', () => {
  it('queda en 0: sin tinte hacia accent', () => {
    for (const theme of THEMES) {
      expect(computePlaneGridWarmth(theme)).toBe(0)
    }
  })
})
