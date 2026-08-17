import { describe, expect, it } from 'vitest'
import { fabAccelLabel, fabHintWithShortcut } from '../planeFabHint'

describe('planeFabHint', () => {
  it('fabAccelLabel devuelve ⌘ en mac y Ctrl+ en windows', () => {
    expect(fabAccelLabel(true)).toBe('⌘')
    expect(fabAccelLabel(false)).toBe('Ctrl+')
  })

  it('fabHintWithShortcut en mac concatena atajo y hint', () => {
    expect(fabHintWithShortcut('Terminal con explorador', 'Y', true)).toBe(
      '⌘Y · Terminal con explorador',
    )
  })

  it('fabHintWithShortcut en windows concatena atajo y hint', () => {
    expect(fabHintWithShortcut('Eliges proveedor y rol', 'A', false)).toBe(
      'Ctrl+A · Eliges proveedor y rol',
    )
  })

  it('fabHintWithShortcut con hint vacío devuelve solo el atajo', () => {
    expect(fabHintWithShortcut('', 'Y', true)).toBe('⌘Y')
    expect(fabHintWithShortcut('   ', 'A', false)).toBe('Ctrl+A')
  })
})
