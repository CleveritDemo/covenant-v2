/**
 * El scrollback se serializa tal cual, y el buffer de una terminal siempre
 * acaba a media línea: en el prompt del shell, sin salto final. Al restaurarlo
 * el cursor queda en mitad de esa línea, así que cuando el shell nuevo pinta su
 * prompt ve el cursor fuera de la columna 0 y antepone su marca de fin de línea
 * (el `%` en vídeo inverso de zsh, `PROMPT_EOL_MARK`). Eso se vuelve a
 * serializar y se acumula un prompt muerto por cada arranque.
 *
 * La última línea sobra siempre: la escribió un shell que ya no existe y el
 * nuevo va a reimprimirla. Se corta, y su prompt empieza limpio en columna 0.
 */
export function trimRestoredScrollback(saved: string): string {
  const lastNewline = saved.lastIndexOf('\n')
  if (lastNewline < 0) return ''
  return saved.slice(0, lastNewline + 1)
}
