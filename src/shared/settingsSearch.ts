/**
 * Buscador de ajustes — filtrado puro, sin React ni i18n.
 *
 * El índice lo arma el modal con los textos ya traducidos: acá solo se compara.
 * Así el mismo filtro sirve en cualquier idioma y se puede testear sin montar
 * el árbol de componentes.
 */

export interface SettingsSearchEntry {
  /** Categoría de la barra lateral a la que hay que ir. */
  category: string
  /** `id` de la sección para hacer scroll; si falta, basta con la categoría. */
  anchor?: string
  /** Lo que se muestra como resultado. */
  title: string
  /** Nombre de la categoría, como contexto bajo el título. */
  categoryLabel: string
  /**
   * Textos que también hacen match sin mostrarse: etiquetas de los campos de la
   * sección, hints y sinónimos. Buscar «fuente» debe encontrar Tipografía.
   */
  terms?: string[]
}

/**
 * Minúsculas y sin diacríticos: en español se escribe «tipografia» tanto como
 * «tipografía», y quien busca no debería tener que acertar el acento.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/**
 * Todas las palabras de la consulta tienen que aparecer en algún lado de la
 * entrada (AND, no OR): «fuente terminal» debe dejar solo Tipografía, no todo
 * lo que mencione terminales.
 */
export function filterSettingsEntries<T extends SettingsSearchEntry>(
  entries: readonly T[],
  query: string,
): T[] {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  return entries.filter(entry => {
    const haystack = normalizeSearchText([
      entry.title,
      entry.categoryLabel,
      ...(entry.terms ?? []),
    ].join(' '))
    return words.every(word => haystack.includes(word))
  })
}
