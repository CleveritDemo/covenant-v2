/**
 * Historial del composer: ↑/↓ recuperan mensajes ya enviados, como en un shell.
 *
 * Toda la aritmética vive aquí como función pura; el componente solo aporta el
 * dato que necesita el DOM (si el cursor está en la primera línea) y aplica el
 * resultado. Un único bit distingue los dos estados: `index === null` es idle
 * (las flechas son del textarea), cualquier número es navegación.
 */

/** Entradas por sesión y por chat. Suficiente para ↑ sin buscador. */
export const MAX_COMPOSER_HISTORY = 50

export type ComposerRecall = {
  /** Nuevo índice: `null` vuelve a idle. */
  index: number | null
  /** Texto que debe quedar en el composer. */
  text: string
  /** Borrador guardado al entrar al historial; se vacía al salir. */
  stash: string
}

/**
 * Agrega un mensaje enviado. Colapsa el duplicado consecutivo (reenviar tres
 * veces lo mismo no debe gastar tres pulsaciones de ↑) y recorta por el tope.
 */
export function rememberComposerEntry(entries: string[], text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return entries
  const next = entries[entries.length - 1] === trimmed ? entries : [...entries, trimmed]
  return next.length > MAX_COMPOSER_HISTORY
    ? next.slice(next.length - MAX_COMPOSER_HISTORY)
    : next
}

/**
 * Resuelve una tecla contra el historial. Devuelve `null` cuando la tecla no le
 * corresponde al historial y debe seguir su camino normal en el textarea.
 *
 * `entries` va del más antiguo al más reciente; `index` cuenta al revés desde
 * el final (0 = último enviado).
 */
export function recallStep(
  entries: string[],
  index: number | null,
  key: string,
  ctx: { draft: string; stash: string; atFirstLine: boolean },
): ComposerRecall | null {
  const at = (i: number): string => entries[entries.length - 1 - i]

  if (key === 'ArrowUp') {
    // En idle solo entra si el cursor ya está arriba del todo: en un mensaje
    // multilínea, ↑ primero sube dentro del texto (igual que zsh).
    if (index === null && !ctx.atFirstLine) return null
    if (!entries.length) return null
    const next = Math.min((index ?? -1) + 1, entries.length - 1)
    return {
      index: next,
      text: at(next),
      stash: index === null ? ctx.draft : ctx.stash,
    }
  }

  if (key === 'ArrowDown') {
    if (index === null) return null
    const next = index - 1
    return next < 0
      ? { index: null, text: ctx.stash, stash: '' }
      : { index: next, text: at(next), stash: ctx.stash }
  }

  if (key === 'Escape') {
    if (index === null) return null
    return { index: null, text: ctx.stash, stash: '' }
  }

  return null
}
