import { describe, expect, it } from 'vitest'
import { relativeTime, relativeTimeFromIso } from '../relativeTime'

const NOW = Date.parse('2026-08-13T12:00:00.000Z')

describe('relativeTime', () => {
  it('minutos, horas y días según la distancia', () => {
    // El texto exacto depende del locale del entorno, así que se comprueba la
    // unidad elegida, que es la decisión del código.
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toMatch(/min/i)
    expect(relativeTime(NOW - 5 * 3_600_000, NOW)).toMatch(/hour|hora/i)
    expect(relativeTime(NOW - 3 * 86_400_000, NOW)).toMatch(/day|día/i)
  })

  it('el futuro no revienta', () => {
    expect(relativeTime(NOW + 2 * 3_600_000, NOW)).toBeTruthy()
  })
})

describe('relativeTimeFromIso', () => {
  it('acepta el ISO que devuelve Jira', () => {
    expect(relativeTimeFromIso('2026-08-13T10:00:00.000Z', NOW)).toMatch(/hour|hora/i)
  })

  it('una fecha vacía o inválida devuelve cadena vacía, no «Invalid Date»', () => {
    // El picker esconde la columna cuando esto es '': una issue sin `updated`
    // no puede pintar un hueco con basura dentro.
    expect(relativeTimeFromIso('', NOW)).toBe('')
    expect(relativeTimeFromIso('no soy una fecha', NOW)).toBe('')
  })
})
