/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { THEMES, applyTheme } from '../presets'

function parseHex(s: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(s.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance(rgb: [number, number, number]): number {
  const lin = (v: number): number => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
}

const DARK_THEMES = THEMES.filter(t => t.appearance !== 'light')

describe('fondos oscuros', () => {
  it.each(DARK_THEMES.map(t => [t.id, t] as const))(
    '%s: luminancia de --bg ≤ 0.02',
    (_id, theme) => {
      applyTheme(theme)
      const bg = theme.vars['--bg']
      const rgb = parseHex(bg)
      expect(rgb).not.toBeNull()
      expect(relativeLuminance(rgb!)).toBeLessThanOrEqual(0.02)
    },
  )
})
