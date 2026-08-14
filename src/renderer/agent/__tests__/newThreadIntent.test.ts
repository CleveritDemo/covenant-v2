import { describe, expect, it } from 'vitest'
import {
  canApplyDeferredNewThread,
  shouldDeferNewThread,
} from '../newThreadIntent'

describe('shouldDeferNewThread', () => {
  it('no difiere solo por busy: el turno se promueve a carril', () => {
    expect(shouldDeferNewThread({ hasActiveDelegation: false })).toBe(false)
  })

  it('difiere si hay delegación activa: no abortar la subtarea', () => {
    expect(shouldDeferNewThread({ hasActiveDelegation: true })).toBe(true)
  })
})

describe('canApplyDeferredNewThread', () => {
  const idle = {
    busy: false,
    settling: false,
    awaitingDelegations: false,
    hasActiveDelegation: false,
  } as const

  it('idle limpio permite aplicar la petición diferida', () => {
    expect(canApplyDeferredNewThread(idle)).toBe(true)
  })

  it('espera a que busy caiga', () => {
    expect(canApplyDeferredNewThread({ ...idle, busy: true })).toBe(false)
  })

  it('espera a que termine la animación de settle', () => {
    expect(canApplyDeferredNewThread({ ...idle, settling: true })).toBe(false)
  })

  it('espera a que la ola de subtareas asiente', () => {
    expect(canApplyDeferredNewThread({ ...idle, awaitingDelegations: true })).toBe(false)
  })

  it('espera a que se libere el hold de delegación de PO', () => {
    expect(canApplyDeferredNewThread({ ...idle, hasActiveDelegation: true })).toBe(false)
  })
})
