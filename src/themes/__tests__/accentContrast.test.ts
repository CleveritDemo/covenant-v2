/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { THEMES, applyTheme } from '../presets'

function ratio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const n = parseInt(hex.replace('#', ''), 16)
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      const x = v / 255
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PAIRS = ['--accent-solid', '--accent-pressed'] as const

describe('contraste de botones sólidos', () => {
  it.each(THEMES.flatMap(t => PAIRS.map(pair => [t.id, pair, t] as const)))(
    '%s: etiqueta sobre %s ≥ 4.5:1',
    (_id, pair, theme) => {
      applyTheme(theme)
      const root = document.documentElement.style
      const bg = root.getPropertyValue(pair)
      const fg = root.getPropertyValue(`${pair}-fg`)
      expect(ratio(bg, fg)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('los temas light llevan etiqueta blanca', () => {
    for (const theme of THEMES.filter(t => t.appearance === 'light')) {
      applyTheme(theme)
      expect(document.documentElement.style.getPropertyValue('--accent-solid-fg')).toBe('#f7f7fc')
    }
  })
})
