/**
 * @vitest-environment jsdom
 *
 * Prueba el mecanismo real, no el string: mete el scrollback en un xterm y
 * mira dónde queda el cursor. zsh escupe su `PROMPT_EOL_MARK` siempre, pero lo
 * tapa redibujando el prompt desde la columna 0; solo se ve si el cursor
 * quedó a media línea. Así que la condición que importa es `cursorX === 0`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { Terminal } from '@xterm/xterm'
import { trimRestoredScrollback } from '../terminalScrollbackRestore'

/** Cola literal de un scrollback guardado por la app (pane «API»). */
const REAL_TAIL = '~/Sources/karlTerminal/ [35m[[32mmain[35m][0m '
  + '[7;1m%[0m'
  + '                                                                             \r\n'
  + '[35m[0m ~/Sources/karlTerminal/ [35m[[32mmain[35m][0m '
  + '[?1h[?66h[?2004h'

let term: Terminal | null = null

afterEach(() => {
  term?.dispose()
  term = null
})

const writeAndGetCursorX = async (data: string): Promise<number> => {
  term = new Terminal({ cols: 120, rows: 30, allowProposedApi: true })
  await new Promise<void>(resolve => term!.write(data, resolve))
  return term.buffer.active.cursorX
}

describe('restauración del scrollback: dónde queda el cursor', () => {
  it('el scrollback crudo deja el cursor a media línea (de ahí el %)', async () => {
    expect(await writeAndGetCursorX(REAL_TAIL)).toBeGreaterThan(0)
  })

  it('recortado, el cursor queda en la columna 0', async () => {
    expect(await writeAndGetCursorX(trimRestoredScrollback(REAL_TAIL))).toBe(0)
  })
})
