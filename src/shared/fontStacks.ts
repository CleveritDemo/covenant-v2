/**
 * Catálogos de fuentes ofrecidas en Ajustes → Apariencia y la conversión de una
 * elección a un stack CSS completo.
 *
 * La app no escribe nombres de familia en sus estilos: todo pasa por `--font-ui`
 * y `--font-mono` (`styles/global.css`). Elegir una fuente es escribir esas dos
 * variables en `:root`; volver a "por defecto" es borrarlas.
 */

/**
 * Familias para la interfaz. La opción "por defecto" es la cadena vacía y no está aquí.
 *
 * La lista puede ser generosa: el selector descarta lo que no esté instalado, así
 * que añadir una fuente que casi nadie tiene no molesta a nadie. Y lo que falte
 * se escribe a mano en el campo libre.
 */
export const UI_FONTS = [
  'Sansation',
  'SF Pro Text',
  'Helvetica Neue',
  'Avenir Next',
  'Optima',
  'Segoe UI',
  'Inter',
  'Geist',
  'Manrope',
  'IBM Plex Sans',
  'Work Sans',
  'Source Sans 3',
  'Open Sans',
  'Lato',
  'Nunito',
  'Roboto',
  'Verdana',
  'Georgia',
] as const

/**
 * Familias para las terminales. Solo monoespaciadas: xterm calcula el ancho de
 * celda con un glifo y asume que todos miden igual, así que una proporcional
 * desalinea el cursor y ensucia el redibujado.
 */
export const MONO_FONTS = [
  'JetBrains Mono',
  'Comic Code',
  'Comic Code Ligatures',
  'Berkeley Mono',
  'MonoLisa',
  'Operator Mono',
  'Dank Mono',
  'Commit Mono',
  'Geist Mono',
  'Victor Mono',
  'Iosevka',
  'Hack',
  'Inconsolata',
  'Fira Code',
  'Cascadia Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Roboto Mono',
  'Ubuntu Mono',
  'DejaVu Sans Mono',
  'SF Mono',
  'Menlo',
  'Monaco',
  'Andale Mono',
  'Consolas',
  'Courier New',
] as const

export type FontKind = 'ui' | 'mono'

/** Cola de fallbacks; coincide con los stacks por defecto de `global.css`. */
const FALLBACK: Record<FontKind, string> = {
  ui: "'Sansation', 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'SF Mono', 'Cascadia Code', 'Fira Code', 'Menlo', monospace",
}

/** Solo letras, dígitos, espacio, guion y punto: lo que puede aparecer en un nombre de familia. */
const SAFE_FAMILY = /^[\w .-]+$/

/**
 * Stack CSS para una elección, o `null` si hay que usar el de `global.css`
 * (elección vacía o nombre no válido — una coma o una comilla podrían inyectar
 * declaraciones al escribirse en `style`).
 */
export function fontStack(choice: string, kind: FontKind): string | null {
  const family = (choice ?? '').trim()
  if (!family || !SAFE_FAMILY.test(family)) return null
  return `'${family}', ${FALLBACK[kind]}`
}
