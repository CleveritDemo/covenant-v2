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

  it('fallos continuos con ventana rodante no repiten el aviso', () => {
    let state: FatalStormState = { timestamps: [], reported: false }
    const base = 200_000
    const gap = 1_000
    for (let i = 0; i < FATAL_STORM_THRESHOLD; i++) {
      const r = noteFatalFailure(state, base + i * gap)
      state = r.state
      if (i === FATAL_STORM_THRESHOLD - 1) expect(r.shouldWarn).toBe(true)
    }
    for (let j = 1; j <= 60; j++) {
      const r = noteFatalFailure(state, base + (FATAL_STORM_THRESHOLD + j - 1) * gap)
      state = r.state
      expect(r.shouldWarn).toBe(false)
      expect(r.state.reported).toBe(true)
    }
    expect(state.timestamps.length).toBeGreaterThanOrEqual(FATAL_STORM_THRESHOLD)
  })

  it('goteo justo por debajo de la ventana no resetea el aviso', () => {
    let state: FatalStormState = { timestamps: [], reported: false }
    const base = 300_000
    const gap = 1_000
    for (let i = 0; i < FATAL_STORM_THRESHOLD; i++) {
      const r = noteFatalFailure(state, base + i * gap)
      state = r.state
      if (i === FATAL_STORM_THRESHOLD - 1) expect(r.shouldWarn).toBe(true)
    }
    let now = base + (FATAL_STORM_THRESHOLD - 1) * gap
    for (let k = 0; k < 5; k++) {
      now += FATAL_STORM_WINDOW_MS - 1
      const r = noteFatalFailure(state, now)
      state = r.state
      expect(r.shouldWarn).toBe(false)
      expect(r.state.reported).toBe(true)
      expect(r.state.timestamps).toHaveLength(2)
    }
  })
})
