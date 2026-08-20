import { describe, expect, it } from 'vitest'
import {
  COACH_CARET_INSET,
  coachCalloutSideOrder,
  resolveCoachCalloutLayout,
} from '../onboardingCalloutPlacement'

const card = { width: 264, height: 96 }
const viewport = { width: 1280, height: 800 }
const base = { card, viewport, gap: 22, margin: 12 }

describe('coachCalloutSideOrder', () => {
  it('prefiere el costado en controles angostos', () => {
    expect(coachCalloutSideOrder({ top: 0, left: 0, width: 36, height: 36 })[0]).toBe('right')
  })

  it('prefiere abajo en anclas anchas', () => {
    expect(coachCalloutSideOrder({ top: 0, left: 0, width: 700, height: 60 })[0]).toBe('bottom')
  })
})

describe('resolveCoachCalloutLayout', () => {
  it('pone el globo a la derecha del botón del rail y apunta a su centro', () => {
    const anchor = { top: 200, left: 40, width: 36, height: 36 }
    const layout = resolveCoachCalloutLayout({ ...base, anchor })

    expect(layout.side).toBe('right')
    expect(layout.left).toBe(40 + 36 + 22)
    expect(layout.top).toBe(218 - card.height / 2)
    expect(layout.caretOffset).toBe(card.height / 2)
  })

  it('salta a la izquierda cuando no cabe a la derecha', () => {
    const anchor = { top: 300, left: 1200, width: 36, height: 36 }
    const layout = resolveCoachCalloutLayout({ ...base, anchor })

    expect(layout.side).toBe('left')
    expect(layout.left).toBe(1200 - 22 - card.width)
  })

  it('usa arriba cuando el ancla ancha está pegada al fondo', () => {
    const anchor = { top: 720, left: 400, width: 480, height: 60 }
    const layout = resolveCoachCalloutLayout({ ...base, anchor })

    expect(layout.side).toBe('top')
    expect(layout.top).toBe(720 - 22 - card.height)
    expect(layout.caretOffset).toBe(card.width / 2)
  })

  it('mantiene el globo dentro de la ventana y la punta dentro del globo', () => {
    const anchor = { top: 8, left: 1240, width: 30, height: 30 }
    const layout = resolveCoachCalloutLayout({ ...base, anchor })

    expect(layout.top).toBeGreaterThanOrEqual(12)
    expect(layout.left).toBeGreaterThanOrEqual(12)
    expect(layout.left + card.width).toBeLessThanOrEqual(viewport.width - 12)
    expect(layout.caretOffset).toBeGreaterThanOrEqual(COACH_CARET_INSET)
    expect(layout.caretOffset).toBeLessThanOrEqual(card.height - COACH_CARET_INSET)
  })

  it('sin lado con espacio cae en el primero del orden', () => {
    const layout = resolveCoachCalloutLayout({
      ...base,
      anchor: { top: 0, left: 0, width: 40, height: 800 },
      viewport: { width: 240, height: 800 },
    })

    expect(layout.side).toBe('right')
  })
})

describe('preferSide', () => {
  it('gana el lado pedido cuando cabe', () => {
    const anchor = { top: 300, left: 500, width: 700, height: 40 }
    // Ancla ancha: el orden normal empezaría por abajo.
    expect(resolveCoachCalloutLayout({ ...base, anchor }).side).toBe('bottom')
    expect(
      resolveCoachCalloutLayout({ ...base, anchor: { ...anchor, width: 120 } }).side,
    ).toBe('right')
    expect(
      resolveCoachCalloutLayout({ ...base, anchor, preferSide: 'top' }).side,
    ).toBe('top')
  })

  it('si el lado pedido no cabe, vuelve el orden normal', () => {
    const layout = resolveCoachCalloutLayout({
      ...base,
      anchor: { top: 300, left: 1200, width: 60, height: 40 },
      preferSide: 'right',
    })
    expect(layout.side).toBe('left')
  })
})
