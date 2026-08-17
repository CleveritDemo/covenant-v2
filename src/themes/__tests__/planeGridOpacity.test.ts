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
  border: string,
  accent: string,
  opacity: number,
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
  function mixLine(b: [number, number, number], a: [number, number, number]): [number, number, number] {
    return [
      Math.round((b[0] * 55 + a[0] * 18) / 73),
      Math.round((b[1] * 55 + a[1] * 18) / 73),
      Math.round((b[2] * 55 + a[2] * 18) / 73),
    ]
  }
  const bgRgb = parseHex(bg)!
  const lineRgb = mixLine(parseHex(border)!, parseHex(accent)!)
  const bgL = lum(bgRgb)
  const lineL = lum(lineRgb)
  // El color-mix de --plane-grid-line suma 73%, así que arrastra ese alfa.
  const alpha = opacity * 0.73
  const blended = bgL * (1 - alpha) + lineL * alpha
  const hi = Math.max(blended, bgL)
  const lo = Math.min(blended, bgL)
  return (hi + 0.05) / (lo + 0.05)
}

function warmSpread(
  border: string,
  accent: string,
  warmth: number,
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
  function mixLine(b: [number, number, number], a: [number, number, number]): [number, number, number] {
    return [
      Math.round((b[0] * 55 + a[0] * 18) / 73),
      Math.round((b[1] * 55 + a[1] * 18) / 73),
      Math.round((b[2] * 55 + a[2] * 18) / 73),
    ]
  }
  function lerp(
    from: [number, number, number],
    to: [number, number, number],
    t: number,
  ): [number, number, number] {
    return [
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t),
    ]
  }
  const borderRgb = parseHex(border)!
  const accentRgb = parseHex(accent)!
  const lineRgb = mixLine(borderRgb, accentRgb)
  const warmRgb = lerp(lineRgb, accentRgb, warmth)
  return lum(warmRgb) - lum(lineRgb)
}

function themeGridContrast(theme: AppTheme): number {
  return gridContrast(
    theme.vars['--bg']!,
    theme.vars['--border']!,
    theme.vars['--accent']!,
    computePlaneGridOpacity(theme),
  )
}

describe('computePlaneGridOpacity', () => {
  it('mantiene la opacidad de referencia en Interstellar', () => {
    expect(computePlaneGridOpacity(getTheme('interstellar'))).toBe(0.619)
  })

  it('mantiene la opacidad de referencia en Interstellar Light', () => {
    expect(computePlaneGridOpacity(getTheme('interstellarLight'))).toBe(0.249)
  })

  it('alinea el contraste de los temas oscuros al de Interstellar', () => {
    const target = themeGridContrast(getTheme('interstellar'))
    for (const theme of THEMES.filter(t => t.appearance !== 'light')) {
      expect(themeGridContrast(theme)).toBeCloseTo(target, 2)
    }
  })

  it('calibra el contraste de los temas claros con notoriedad reducida', () => {
    const target = planeGridTargetContrast(true)
    for (const theme of THEMES.filter(t => t.appearance === 'light')) {
      const ratio = themeGridContrast(theme)
      const opacity = computePlaneGridOpacity(theme)
      if (opacity >= 0.99) {
        // Línea muy pálida: opacidad al tope y el máximo contraste alcanzable.
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
    expect(planeGridTargetContrast(false)).toBeCloseTo(themeGridContrast(getTheme('interstellar')), 2)
    expect(planeGridTargetContrast(true)).toBeCloseTo(themeGridContrast(getTheme('interstellarLight')), 2)
  })
})

describe('computePlaneGridLineRgb', () => {
  it('resuelve el color-mix a rgb() para canvas y WebGL', () => {
    expect(computePlaneGridLineRgb(getTheme('interstellar'))).toBe('rgb(78, 73, 64)')
  })

  it('da una línea clara en temas light, no blanca', () => {
    expect(computePlaneGridLineRgb(getTheme('interstellarLight'))).toBe('rgb(194, 188, 178)')
  })
})

describe('computePlaneGridWarmth', () => {
  it('mantiene el resplandor de referencia en Interstellar', () => {
    expect(computePlaneGridWarmth(getTheme('interstellar'))).toBe(0.42)
  })

  it('alinea el spread línea→acento de todos los temas oscuros al de Interstellar', () => {
    const ref = getTheme('interstellar')
    const refWarmth = computePlaneGridWarmth(ref)
    const target = warmSpread(ref.vars['--border']!, ref.vars['--accent']!, refWarmth)
    const darkThemes = THEMES.filter(t => !t.appearance || t.appearance === 'dark')
    for (const theme of darkThemes) {
      const warmth = computePlaneGridWarmth(theme)
      const spread = warmSpread(theme.vars['--border']!, theme.vars['--accent']!, warmth)
      expect(spread).toBeCloseTo(target, 2)
    }
  })

  it('alinea el spread línea→acento de todos los temas light al de Interstellar Light', () => {
    const ref = getTheme('interstellarLight')
    const refWarmth = computePlaneGridWarmth(ref)
    const target = warmSpread(ref.vars['--border']!, ref.vars['--accent']!, refWarmth)
    const lightThemes = THEMES.filter(t => t.appearance === 'light')
    for (const theme of lightThemes) {
      const warmth = computePlaneGridWarmth(theme)
      const spread = warmSpread(theme.vars['--border']!, theme.vars['--accent']!, warmth)
      expect(spread).toBeCloseTo(target, 2)
    }
  })
})
