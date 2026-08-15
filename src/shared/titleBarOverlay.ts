/** Alineado a `--titlebar-height` en `src/renderer/styles/global.css` (36px). */
export const TITLEBAR_OVERLAY_HEIGHT = 36
export const DEFAULT_OVERLAY_COLOR = '#0d0d14'
export const DEFAULT_OVERLAY_SYMBOL = '#e8e8f0'

/** Solo `#rgb` / `#rrggbb` (case-insensitive) → `#rrggbb` minúsculas; si no, `fallback`. */
export function sanitizeOverlayColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value)
  if (!m) return fallback
  const hex = m[1].toLowerCase()
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
  }
  return `#${hex}`
}
