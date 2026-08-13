import { describe, expect, it } from 'vitest'
import { brainstormSeatTail } from '@shared/brainstormSeatTail'
import { brainstormContextLabel } from '@shared/brainstormContextLabel'

describe('brainstormSeatTail', () => {
  it('se queda con la última línea con texto', () => {
    expect(brainstormSeatTail('Primero esto.\n\nY al final esto otro.\n\n'))
      .toBe('Y al final esto otro.')
  })

  it('limpia viñetas, citas y énfasis: la tarjeta no pinta markdown', () => {
    expect(brainstormSeatTail('- una cosa\n- **otra** cosa')).toBe('otra cosa')
    expect(brainstormSeatTail('> lo dijo el otro')).toBe('lo dijo el otro')
    expect(brainstormSeatTail('usa `app.tenant_id`')).toBe('usa app.tenant_id')
  })

  it('el turno en curso corta a media frase, y así se muestra', () => {
    expect(brainstormSeatTail('RLS → schemas es un split, y eso necesita un'))
      .toBe('RLS → schemas es un split, y eso necesita un')
  })

  it('sin texto util devuelve vacío: la tarjeta dirá que aún no habla', () => {
    expect(brainstormSeatTail('   \n\n')).toBe('')
  })
})

describe('brainstormContextLabel', () => {
  it('saca tipo y nombre legible del id', () => {
    expect(brainstormContextLabel('iaterminal:notes:Front-Rules'))
      .toEqual({ tag: 'notes', label: 'Front Rules' })
    expect(brainstormContextLabel('iaterminal:folderTree:Back_Folders'))
      .toEqual({ tag: 'folderTree', label: 'Back Folders' })
  })

  it('sin nombre, el tipo hace de etiqueta', () => {
    expect(brainstormContextLabel('iaterminal:git:')).toEqual({ tag: 'git', label: 'git' })
  })
})
