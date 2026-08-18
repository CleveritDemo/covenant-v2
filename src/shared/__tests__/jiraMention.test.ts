import { describe, expect, it } from 'vitest'
import {
  issueMentionQueryAt,
  issueMentionRangeAt,
} from '../issueMention'

const at = (text: string) => issueMentionQueryAt(text, text.length, true)

describe('issueMentionQueryAt', () => {
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
    expect(issueMentionQueryAt(text, text.length, true)).toBeNull()
  })

  it('el cursor en medio del texto mira lo que hay a su izquierda', () => {
    const text = 'antes #GRAV-4 después'
    expect(issueMentionQueryAt(text, 'antes #GRAV-4'.length, true)).toBe('GRAV-4')
  })

  it('sin fuentes conectadas no hay picker: no se interrumpe', () => {
    expect(issueMentionQueryAt('#GRAV-4', 7, false)).toBeNull()
  })

  it('con GitHub conectado y sin projectKeys de Jira, `#` abre', () => {
    expect(issueMentionQueryAt('#123', 4, true)).toBe('123')
    expect(issueMentionQueryAt('#', 1, true)).toBe('')
    expect(issueMentionQueryAt('revisa #login', 13, true)).toBe('login')
  })
})

describe('issueMentionRangeAt', () => {
  it('el `start` incluye el `#` para poder reemplazar el token completo', () => {
    const text = 'revisa #deadlock'
    const caret = text.length
    const range = issueMentionRangeAt(text, caret, true)
    expect(range).toEqual({ start: 7, end: caret, query: 'deadlock' })
    expect(text.slice(range!.start, range!.end)).toBe('#deadlock')
  })

  it('issueMentionQueryAt es un envoltorio exacto de issueMentionRangeAt', () => {
    const text = 'revisa #grav-41'
    expect(issueMentionQueryAt(text, text.length, true)).toBe(
      issueMentionRangeAt(text, text.length, true)?.query ?? null,
    )
  })
})
