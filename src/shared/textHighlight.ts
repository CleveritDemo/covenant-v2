/**
 * Partir un texto por la coincidencia de una búsqueda, para poder resaltarla.
 *
 * Puro y sin React: lo que decide qué se marca es lógica, y el componente solo
 * elige la etiqueta con la que pintarlo.
 */

export interface HighlightPart {
  text: string
  match: boolean
}

/**
 * Primera coincidencia, sin distinguir mayúsculas ni acentos de más: es un
 * resaltado de ayuda visual, no un resaltador de resultados de búsqueda. Si no
 * hay coincidencia devuelve el texto entero como una sola parte, así que el
 * llamador no necesita casos especiales.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const source = text ?? ''
  const needle = (query ?? '').trim()
  if (!needle) return [{ text: source, match: false }]

  const at = source.toLowerCase().indexOf(needle.toLowerCase())
  if (at < 0) return [{ text: source, match: false }]

  return [
    { text: source.slice(0, at), match: false },
    { text: source.slice(at, at + needle.length), match: true },
    { text: source.slice(at + needle.length), match: false },
  ].filter(part => part.text !== '')
}
