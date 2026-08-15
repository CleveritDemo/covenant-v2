import { describe, it, expect } from 'vitest'
import {
  decideRendererCrashRecovery,
  RENDERER_RELOAD_MAX_ATTEMPTS,
  RENDERER_RELOAD_WINDOW_MS,
} from '../rendererCrashRecovery'

describe('decideRendererCrashRecovery', () => {
  it('recarga en el primer crash', () => {
    const d = decideRendererCrashRecovery({
      reason: 'crashed',
      quitting: false,
      attemptsMs: [],
      now: 1_000,
    })
    expect(d.action).toBe('reload')
    expect(d.attemptsMs).toEqual([1_000])
  })

  it('recarga cuando macOS mata el renderer por memoria (`killed`)', () => {
    expect(
      decideRendererCrashRecovery({ reason: 'killed', quitting: false, attemptsMs: [], now: 1 })
        .action,
    ).toBe('reload')
  })

  it('ignora el cierre limpio', () => {
    expect(
      decideRendererCrashRecovery({ reason: 'clean-exit', quitting: false, attemptsMs: [], now: 1 })
        .action,
    ).toBe('ignore')
  })

  it('ignora cualquier motivo mientras la app sale', () => {
    expect(
      decideRendererCrashRecovery({ reason: 'crashed', quitting: true, attemptsMs: [], now: 1 })
        .action,
    ).toBe('ignore')
  })

  it('se rinde tras el tope de intentos dentro de la ventana', () => {
    const attempts = Array.from({ length: RENDERER_RELOAD_MAX_ATTEMPTS }, (_, i) => 1_000 + i)
    const d = decideRendererCrashRecovery({
      reason: 'crashed',
      quitting: false,
      attemptsMs: attempts,
      now: 2_000,
    })
    expect(d.action).toBe('give-up')
    expect(d.attemptsMs).toEqual(attempts)
  })

  it('olvida intentos fuera de la ventana y vuelve a recargar', () => {
    const old = Array.from({ length: RENDERER_RELOAD_MAX_ATTEMPTS }, (_, i) => 1_000 + i)
    // Fuera de la ventana respecto al intento MÁS RECIENTE, no al primero.
    const now = old[old.length - 1] + RENDERER_RELOAD_WINDOW_MS + 1
    const d = decideRendererCrashRecovery({
      reason: 'crashed',
      quitting: false,
      attemptsMs: old,
      now,
    })
    expect(d.action).toBe('reload')
    expect(d.attemptsMs).toEqual([now])
  })

  it('no acumula intentos caducados al ignorar', () => {
    const d = decideRendererCrashRecovery({
      reason: 'clean-exit',
      quitting: false,
      attemptsMs: [10, 20],
      now: 10 + RENDERER_RELOAD_WINDOW_MS,
    })
    expect(d.attemptsMs).toEqual([20])
  })
})
