import { describe, expect, it } from 'vitest'
import {
  brainstormSeatCellHeight,
  brainstormSeatTier,
} from '@shared/brainstormSeatCell'
import { PLANE_MINI_WINDOW_HEIGHT } from '@shared/paneWindows'

describe('brainstormSeatCellHeight', () => {
  it('encoge la celda al sumar asientos', () => {
    const three = brainstormSeatCellHeight(900, 3)
    const six = brainstormSeatCellHeight(900, 6)
    expect(six).toBeLessThan(three)
  })

  it('no baja del mínimo de las minis del plano: ahí scrollea la columna', () => {
    expect(brainstormSeatCellHeight(900, 20)).toBe(PLANE_MINI_WINDOW_HEIGHT)
  })
})

describe('brainstormSeatTier', () => {
  it('recorta contenido según el alto disponible', () => {
    expect(brainstormSeatTier(PLANE_MINI_WINDOW_HEIGHT)).toBe('compact')
    expect(brainstormSeatTier(150)).toBe('default')
    expect(brainstormSeatTier(200)).toBe('roomy')
  })
})
