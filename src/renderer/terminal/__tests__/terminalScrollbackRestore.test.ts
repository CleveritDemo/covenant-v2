import { describe, expect, it } from 'vitest'
import { trimRestoredScrollback } from '../terminalScrollbackRestore'

/** Prompt de zsh serializado, tal como aparece en los .txt guardados. */
const PROMPT = '[35m[0m ~/Sources/groowcity/ [35m[[32mmain[35m][0m '
/** Marca de fin de línea de zsh (`PROMPT_EOL_MARK`): reverse + bold + `%`. */
const EOL_MARK = '[7;1m%[0m'

describe('trimRestoredScrollback', () => {
  it('corta el prompt final sin salto de línea', () => {
    expect(trimRestoredScrollback(`npm test\r\nok\r\n${PROMPT}`)).toBe('npm test\r\nok\r\n')
  })

  it('lo devuelve intacto si ya acaba en salto', () => {
    expect(trimRestoredScrollback('npm test\r\nok\r\n')).toBe('npm test\r\nok\r\n')
  })

  it('deja vacío un buffer de una sola línea a medias', () => {
    expect(trimRestoredScrollback(PROMPT)).toBe('')
    expect(trimRestoredScrollback('')).toBe('')
  })

  it('no reintroduce el prompt que provoca la marca de fin de línea', () => {
    // Cola real: un prompt ya marcado con `%` y otro vivo sin cerrar.
    const saved = `${PROMPT}${EOL_MARK}\r\n${PROMPT}[?2004h`
    const restored = trimRestoredScrollback(saved)
    expect(restored.endsWith('\n')).toBe(true)
    // El shell nuevo arranca en columna 0 → no añade otra marca.
    expect(restored).toBe(`${PROMPT}${EOL_MARK}\r\n`)
  })

  it('conserva el contenido previo, solo se lleva la última línea', () => {
    const saved = 'linea 1\r\nlinea 2\r\nprompt a medias'
    expect(trimRestoredScrollback(saved)).toBe('linea 1\r\nlinea 2\r\n')
  })
})
