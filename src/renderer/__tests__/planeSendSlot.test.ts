import { describe, expect, it } from 'vitest'
import { claimPlaneSendSlot, releasePlaneSendSlot } from '../planeSendSlot'

const head = { sendId: 'send-1', text: 'hola' }

describe('claimPlaneSendSlot', () => {
  it('toma el hueco libre y lo reporta en el acto', () => {
    const { slots, claimed } = claimPlaneSendSlot({}, 'pane-1', head)
    expect(claimed).toBe(true)
    expect(slots['pane-1']).toBe(head)
  })

  it('no pisa un buzón ocupado y avisa que no pudo', () => {
    const busy = { 'pane-1': { sendId: 'otro', text: 'x' } }
    const { slots, claimed } = claimPlaneSendSlot(busy, 'pane-1', head)
    expect(claimed).toBe(false)
    expect(slots).toBe(busy)
  })
})

describe('releasePlaneSendSlot', () => {
  it('vacía el buzón del envío consumido', () => {
    const slots = releasePlaneSendSlot({ 'pane-1': head }, 'pane-1', 'send-1')
    expect(slots['pane-1']).toBeUndefined()
  })

  it('no tira un envío distinto que entró mientras tanto', () => {
    const nuevo = { 'pane-1': { sendId: 'send-2', text: 'nuevo' } }
    expect(releasePlaneSendSlot(nuevo, 'pane-1', 'send-1')).toBe(nuevo)
  })

  it('soltar dos veces el mismo envío es inofensivo', () => {
    const once = releasePlaneSendSlot({ 'pane-1': head }, 'pane-1', 'send-1')
    expect(releasePlaneSendSlot(once, 'pane-1', 'send-1')).toEqual({})
  })

  it('sin sendId vacía el buzón actual', () => {
    expect(releasePlaneSendSlot({ 'pane-1': head }, 'pane-1')).toEqual({})
  })

  it('el interbloqueo reportado ya no se arma', () => {
    // Ola turbo: el drenaje coloca el envío y —creyendo que no pudo— lo
    // devolvía a la FIFO. Al reofrecerse, el pane lo soltaba una sola vez por
    // sendId y el buzón quedaba tomado: FIFO retenida, systemFollowUpsPending
    // en true y la cola humana congelada.
    const first = claimPlaneSendSlot({}, 'pane-1', head)
    expect(first.claimed).toBe(true)
    const afterTurn = releasePlaneSendSlot(first.slots, 'pane-1', 'send-1')
    const reoffer = claimPlaneSendSlot(afterTurn, 'pane-1', head)
    expect(reoffer.claimed).toBe(true)
    expect(releasePlaneSendSlot(reoffer.slots, 'pane-1', 'send-1')).toEqual({})
  })
})
