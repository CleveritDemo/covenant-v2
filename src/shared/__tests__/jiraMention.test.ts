import { describe, expect, it } from 'vitest'
import { mentionQueryAt } from '../jiraIssue'

const keys = ['GRAV', 'COV']
const at = (text: string) => mentionQueryAt(text, text.length, keys)

describe('mentionQueryAt', () => {
  it('un prefijo de proyecto con guion abre el picker', () => {
    expect(at('arregla GRAV-')).toBe('GRAV-')
    expect(at('arregla GRAV-41')).toBe('GRAV-41')
  })

  it('minúsculas también', () => {
    expect(at('arregla grav-41')).toBe('GRAV-41')
  })

  it('un prefijo desconocido no abre nada', () => {
    expect(at('usa UTF-')).toBeNull()
    expect(at('mira CVE-2023')).toBeNull()
  })

  it('solo el token pegado al cursor cuenta', () => {
    expect(mentionQueryAt('GRAV-412 ya está', 'GRAV-412 ya está'.length, keys)).toBeNull()
  })

  it('el cursor en medio del texto mira lo que hay a su izquierda', () => {
    const text = 'antes GRAV-4 después'
    expect(mentionQueryAt(text, 'antes GRAV-4'.length, keys)).toBe('GRAV-4')
  })

  it('sin projectKeys no hay picker en ningún caso', () => {
    expect(mentionQueryAt('GRAV-4', 6, [])).toBeNull()
  })

  it('un @ suelto abre la búsqueda libre', () => {
    expect(at('revisa @deadlock')).toBe('deadlock')
    expect(at('revisa @')).toBe('')
  })
})
