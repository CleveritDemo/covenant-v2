/**
 * Comprobación de fuentes: se mide un texto en canvas contra las tres familias
 * genéricas y, si el ancho cambia al anteponer la familia, es que existe.
 *
 * No hay enumeración del sistema: `queryLocalFonts()` no está expuesta en
 * Electron 33 (ni activando `--enable-features=FontAccess`), y sacar la lista
 * desde el proceso main obliga a parsear la tabla `name` de cada archivo o a
 * llamar a `system_profiler`, que solo sirve en macOS. Por eso el selector
 * combina un catálogo curado con un campo donde escribir cualquier nombre:
 * medir sí funciona con cualquier familia, solo falta saber cómo se llama.
 */

const PROBE = 'mmmmmmmmmmlliWWWW0O'
const BASES = ['monospace', 'serif', 'sans-serif'] as const

let ctx: CanvasRenderingContext2D | null | undefined
let baseWidths: number[] | null = null

function context(): CanvasRenderingContext2D | null {
  // try/catch por jsdom: ahí `getContext` no está implementado y lanza.
  if (ctx === undefined) {
    try { ctx = document.createElement('canvas').getContext('2d') } catch { ctx = null }
  }
  return ctx
}

function widthIn(font: string, text: string): number {
  const c = context()
  if (!c) return 0
  c.font = `72px ${font}`
  return c.measureText(text).width
}

export function isFontInstalled(family: string): boolean {
  if (!family.trim()) return true
  if (!context()) return true // sin canvas no filtramos: mejor ofrecer de más que de menos
  baseWidths ??= BASES.map(b => widthIn(b, PROBE))
  return BASES.some((base, i) => widthIn(`'${family}', ${base}`, PROBE) !== baseWidths![i])
}

/** Monoespaciada = todos los glifos miden igual. Es lo que xterm necesita. */
export function isMonospaced(family: string): boolean {
  if (!family.trim() || !context()) return true
  const quoted = `'${family}', monospace`
  return widthIn(quoted, 'i') === widthIn(quoted, 'W')
}

export function availableFonts(catalog: readonly string[]): string[] {
  return catalog.filter(isFontInstalled)
}
