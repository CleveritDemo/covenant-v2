import { describe, expect, it } from 'vitest'
import { mentionQueryAt, mentionRangeAt } from '../jiraIssue'

const keys = ['GRAV', 'COV']
const at = (text: string) => mentionQueryAt(text, text.length, keys)

describe('mentionQueryAt', () => {
  it('`#` abre la búsqueda', () => {
    expect(at('revisa #login')).toBe('login')
    expect(at('revisa #')).toBe('')
    expect(at('revisa #CT-12')).toBe('CT-12')
  })

  it('una clave suelta NO abre nada: escribir prosa no debe interrumpir', () => {
    // Con la lista abierta, Enter elige en vez de enviar. Escribir
    // `arregla GRAV-128` en medio de una frase no puede secuestrar el envío.
    expect(at('arregla GRAV-')).toBeNull()
    expect(at('arregla GRAV-41')).toBeNull()
    expect(at('arregla grav-41')).toBeNull()
  })

  it('`@` no abre issues: queda libre para dirigirse a un agente', () => {
    expect(at('revisa @deadlock')).toBeNull()
  })

  it('solo el token pegado al cursor cuenta', () => {
    const text = '#GRAV-412 ya está'
    expect(mentionQueryAt(text, text.length, keys)).toBeNull()
  })

  it('el cursor en medio del texto mira lo que hay a su izquierda', () => {
    const text = 'antes #GRAV-4 después'
    expect(mentionQueryAt(text, 'antes #GRAV-4'.length, keys)).toBe('GRAV-4')
  })

  it('sin projectKeys no hay picker: sin proyecto conectado no se interrumpe', () => {
    expect(mentionQueryAt('#GRAV-4', 7, [])).toBeNull()
  })
})

describe('mentionRangeAt', () => {
  it('el `start` incluye el `#` para poder reemplazar el token completo', () => {
    const text = 'revisa #deadlock'
    const caret = text.length
    const range = mentionRangeAt(text, caret, keys)
    expect(range).toEqual({ start: 7, end: caret, query: 'deadlock' })
    expect(text.slice(range!.start, range!.end)).toBe('#deadlock')
  })

  it('mentionQueryAt es un envoltorio exacto de mentionRangeAt', () => {
    const text = 'revisa #grav-41'
    expect(mentionQueryAt(text, text.length, keys)).toBe(
      mentionRangeAt(text, text.length, keys)?.query ?? null,
    )
  })
})
