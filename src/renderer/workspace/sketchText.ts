/**
 * Tipografía del lienzo de sketch: puro, sin canvas ni React, para poder testear
 * el tamaño y el corte de líneas sin montar el modal.
 */

/** Tamaño de fuente lógico según el grosor de trazo activo en la barra. */
export function sketchFontSize(width: number): number {
  if (width === 2) return 14
  if (width === 3) return 20
  if (width === 6) return 30
  return 20
}

/** Cadena de font para fillText; el canvas no entiende var(--font-ui). */
export function sketchTextFont(fontPx: number): string {
  return `${fontPx}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
}

export function sketchTextLineHeight(fontPx: number): number {
  return Math.round(fontPx * 1.25)
}

/** Líneas no vacías al final; todo vacío → []. */
export function sketchTextLines(value: string): string[] {
  const lines = value.split('\n')
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  if (lines.length === 1 && lines[0] === '') return []
  return lines
}
