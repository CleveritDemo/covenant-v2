import { describe, expect, it } from 'vitest'
import { shouldMarkBusyOnCliError, turnFailedAfter } from '../turnFailureState'

describe('turnFailedAfter', () => {
  it('marca el fallo cuando el CLI emite un error', () => {
    expect(turnFailedAfter('cli-error', false)).toBe(true)
  })

  it('conserva el fallo al cerrar el turno', () => {
    // Regresión: si el cierre lo limpiara, la reconciliación idle vería el pane
    // parado sin fallo y cerraría la delegación como correcta.
    expect(turnFailedAfter('close', true)).toBe(true)
  })

  it('no inventa un fallo al cerrar un turno correcto', () => {
    expect(turnFailedAfter('close', false)).toBe(false)
  })

  it('lo limpia el arranque del siguiente turno y el reintento', () => {
    expect(turnFailedAfter('start', true)).toBe(false)
    expect(turnFailedAfter('retry', true)).toBe(false)
  })

  it('lo limpia el stop del usuario', () => {
    expect(turnFailedAfter('stop', true)).toBe(false)
  })
})

describe('shouldMarkBusyOnCliError', () => {
  it('marca busy mientras el turno sigue vivo', () => {
    expect(shouldMarkBusyOnCliError(false)).toBe(true)
  })

  it('no remarca busy si el turno ya se cerró', () => {
    expect(shouldMarkBusyOnCliError(true)).toBe(false)
  })
})
