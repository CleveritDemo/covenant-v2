import { describe, expect, it } from 'vitest'
import {
  canApplyDeferredNewThread,
  shouldDeferNewThread,
} from '../newThreadIntent'

describe('shouldDeferNewThread', () => {
  it('difiere si el pane está busy: no abortar turno vivo', () => {
    expect(shouldDeferNewThread({ busy: true, hasActiveDelegation: false })).toBe(true)
  })

  it('difiere si hay delegación activa: no abortar la subtarea', () => {
    expect(shouldDeferNewThread({ busy: false, hasActiveDelegation: true })).toBe(true)
  })

  it('idle limpio se aplica inmediatamente', () => {
    expect(shouldDeferNewThread({ busy: false, hasActiveDelegation: false })).toBe(false)
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
