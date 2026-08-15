import { describe, it, expect } from 'vitest'
import {
  FATAL_STORM_THRESHOLD,
  FATAL_STORM_WINDOW_MS,
  noteFatalFailure,
  type FatalStormState,
} from '../mainFailureStorm'

describe('noteFatalFailure', () => {
  it('9 fallos seguidos no avisan', () => {
    let state: FatalStormState = { timestamps: [], reported: false }
    const base = 1_000
    for (let i = 0; i < FATAL_STORM_THRESHOLD - 1; i++) {
      const r = noteFatalFailure(state, base + i)
      state = r.state
      expect(r.shouldWarn).toBe(false)
    }
    expect(state.timestamps).toHaveLength(FATAL_STORM_THRESHOLD - 1)
    expect(state.reported).toBe(false)
  })

  it('el décimo dentro de la ventana avisa una sola vez y los siguientes no', () => {
    let state: FatalStormState = { timestamps: [], reported: false }
    const base = 10_000
    for (let i = 0; i < FATAL_STORM_THRESHOLD - 1; i++) {
      state = noteFatalFailure(state, base + i).state
    }
    const tenth = noteFatalFailure(state, base + FATAL_STORM_THRESHOLD - 1)
    expect(tenth.shouldWarn).toBe(true)
    expect(tenth.state.reported).toBe(true)

    const eleventh = noteFatalFailure(tenth.state, base + FATAL_STORM_THRESHOLD)
    expect(eleventh.shouldWarn).toBe(false)
    expect(eleventh.state.reported).toBe(true)
  })

  it('tras 60 s sin fallos, una nueva tanda de 10 vuelve a avisar', () => {
    let state: FatalStormState = { timestamps: [], reported: false }
    const base = 100_000
    for (let i = 0; i < FATAL_STORM_THRESHOLD; i++) {
      const r = noteFatalFailure(state, base + i)
      state = r.state
      if (i === FATAL_STORM_THRESHOLD - 1) expect(r.shouldWarn).toBe(true)
    }
    expect(state.reported).toBe(true)

    const afterQuiet = noteFatalFailure(state, base + FATAL_STORM_WINDOW_MS + FATAL_STORM_THRESHOLD)
    expect(afterQuiet.state.reported).toBe(false)
    expect(afterQuiet.shouldWarn).toBe(false)

    let next = afterQuiet.state
    const quietBase = base + FATAL_STORM_WINDOW_MS + FATAL_STORM_THRESHOLD
    for (let i = 1; i < FATAL_STORM_THRESHOLD; i++) {
      const r = noteFatalFailure(next, quietBase + i)
      next = r.state
      if (i === FATAL_STORM_THRESHOLD - 1) {
        expect(r.shouldWarn).toBe(true)
      } else {
        expect(r.shouldWarn).toBe(false)
      }
    }
  })

  it('fallos espaciados más de la ventana nunca acumulan hasta el umbral', () => {
    let state: FatalStormState = { timestamps: [], reported: false }
    const gap = FATAL_STORM_WINDOW_MS + 1
    for (let i = 0; i < FATAL_STORM_THRESHOLD * 2; i++) {
      const r = noteFatalFailure(state, i * gap)
      state = r.state
      expect(r.shouldWarn).toBe(false)
      expect(state.timestamps).toHaveLength(1)
    }
  })

  it('no muta el array de entrada', () => {
    const input: FatalStormState = { timestamps: [1, 2, 3], reported: false }
    const copy = [...input.timestamps]
    noteFatalFailure(input, 4)
    expect(input.timestamps).toEqual(copy)
    expect(input.reported).toBe(false)
  })
})
