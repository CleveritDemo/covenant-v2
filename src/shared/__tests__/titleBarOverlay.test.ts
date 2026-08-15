import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OVERLAY_COLOR,
  sanitizeOverlayColor,
} from '../titleBarOverlay'

describe('sanitizeOverlayColor', () => {
  const fb = DEFAULT_OVERLAY_COLOR

  it('expande hex corto a #rrggbb', () => {
    expect(sanitizeOverlayColor('#abc', fb)).toBe('#aabbcc')
    expect(sanitizeOverlayColor('#0d0', fb)).toBe('#00dd00')
  })

  it('normaliza hex largo a minúsculas', () => {
    expect(sanitizeOverlayColor('#0d0d14', fb)).toBe('#0d0d14')
    expect(sanitizeOverlayColor('#E8E8F0', fb)).toBe('#e8e8f0')
    expect(sanitizeOverlayColor('#AaBbCc', fb)).toBe('#aabbcc')
  })

  it('acepta mayúsculas en hex corto', () => {
    expect(sanitizeOverlayColor('#ABC', fb)).toBe('#aabbcc')
  })

  it('rechaza vacío, null y nombres CSS', () => {
    expect(sanitizeOverlayColor('', fb)).toBe(fb)
    expect(sanitizeOverlayColor(null, fb)).toBe(fb)
    expect(sanitizeOverlayColor('red', fb)).toBe(fb)
    expect(sanitizeOverlayColor('rgb(0,0,0)', fb)).toBe(fb)
  })

  it('rechaza comillas o espacios alrededor', () => {
    expect(sanitizeOverlayColor(' #abc ', fb)).toBe(fb)
    expect(sanitizeOverlayColor('"#0d0d14"', fb)).toBe(fb)
    expect(sanitizeOverlayColor("'#abc'", fb)).toBe(fb)
  })
})
