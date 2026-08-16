import { describe, expect, it, vi } from 'vitest'
import {
  PASTED_TEXT_MIN_CHARS,
  PASTED_TEXT_MIN_LINES,
  composeTextWithPastes,
  createPastedText,
  formatPastedTextSize,
  pastedTextPreview,
  shouldCapturePastedText,
  type ComposerPastedText,
} from '../composerPastedText'

describe('shouldCapturePastedText', () => {
  it('captura por caracteres cuando alcanza el umbral', () => {
    expect(shouldCapturePastedText('x'.repeat(PASTED_TEXT_MIN_CHARS - 1))).toBe(false)
    expect(shouldCapturePastedText('x'.repeat(PASTED_TEXT_MIN_CHARS))).toBe(true)
  })

  it('captura por líneas aunque el texto sea corto', () => {
    const shortLines = Array.from({ length: PASTED_TEXT_MIN_LINES }, (_, i) => `L${i}`).join('\n')
    expect(shortLines.length).toBeLessThan(PASTED_TEXT_MIN_CHARS)
    expect(shouldCapturePastedText(shortLines)).toBe(true)
    expect(shouldCapturePastedText(Array.from({ length: PASTED_TEXT_MIN_LINES - 1 }, (_, i) => `L${i}`).join('\n'))).toBe(false)
  })

  it('cuenta líneas con CRLF', () => {
    const crlf = Array.from({ length: PASTED_TEXT_MIN_LINES }, (_, i) => `L${i}`).join('\r\n')
    expect(shouldCapturePastedText(crlf)).toBe(true)
  })
})

describe('createPastedText', () => {
  it('arma id, conteos y byteSize', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    })
    const text = 'hola\nmundo'
    const paste = createPastedText(text)
    expect(paste.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(paste.text).toBe(text)
    expect(paste.charCount).toBe(text.length)
    expect(paste.lineCount).toBe(2)
    expect(paste.byteSize).toBe(new TextEncoder().encode(text).length)
  })
})

describe('formatPastedTextSize', () => {
  it('formatea B / KB / MB', () => {
    expect(formatPastedTextSize(500)).toBe('500 B')
    expect(formatPastedTextSize(1023)).toBe('1023 B')
    expect(formatPastedTextSize(1024)).toBe('1.00 KB')
    expect(formatPastedTextSize(1536)).toBe('1.50 KB')
    expect(formatPastedTextSize(1024 * 1024 - 1)).toBe(`${((1024 * 1024 - 1) / 1024).toFixed(2)} KB`)
    expect(formatPastedTextSize(1024 * 1024)).toBe('1.00 MB')
    expect(formatPastedTextSize(2.5 * 1024 * 1024)).toBe('2.50 MB')
  })
})

describe('pastedTextPreview', () => {
  it('recorta con ellipsis si excede', () => {
    expect(pastedTextPreview('corto')).toBe('corto')
    expect(pastedTextPreview('x'.repeat(180))).toBe('x'.repeat(180))
    expect(pastedTextPreview('x'.repeat(181))).toBe(`${'x'.repeat(180)}…`)
    expect(pastedTextPreview('abcdef', 4)).toBe('abcd…')
  })
})

describe('composeTextWithPastes', () => {
  it('une typed y pastes con doble salto, descartando vacíos', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => 'bbbbbbbb-cccc-dddd-eeee-ffff-gggggggggggg',
    })
    const pastes: ComposerPastedText[] = [
      createPastedText('uno'),
      createPastedText(''),
      createPastedText('  dos  '),
    ]
    expect(composeTextWithPastes('  hola  ', pastes)).toBe('hola\n\nuno\n\n  dos  ')
    expect(composeTextWithPastes('   ', [createPastedText('solo')])).toBe('solo')
    expect(composeTextWithPastes('solo typed', [])).toBe('solo typed')
    expect(composeTextWithPastes('  ', [])).toBe('')
  })
})
