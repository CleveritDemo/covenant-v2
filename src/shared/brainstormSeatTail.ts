import { stripBrainstormProtocolFences } from '@shared/brainstormRoom'

/**
 * Última línea del turno, tal cual la dejó el agente.
 *
 * Es lo que muestra su tarjeta en la columna de asientos: sale de lo que ya
 * está en el estado vivo, así que no pide un campo nuevo al protocolo de
 * cierre. A cambio, mientras el agente escribe la línea corta a media frase —es
 * rastro de dónde va, no un titular— y por eso la tarjeta la marca con cursor.
 */
export function brainstormSeatTail(text: string): string {
  const clean = stripBrainstormProtocolFences(text)
  const lines = clean.split('\n')
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    // La tarjeta pinta texto plano, no markdown: fuera viñetas, citas y
    // titulares al principio, y los énfasis y comillas de código sueltos.
    const line = lines[index]
      .replace(/^\s*(?:[>#]+\s*|[*+-]\s+)+/, '')
      .replace(/\*\*|__|`/g, '')
      .trim()
    if (line) return line
  }
  return ''
}
