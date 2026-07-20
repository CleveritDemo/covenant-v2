import { describe, expect, it } from 'vitest'
import {
  buildLoopPrompt,
  formatLoopIntervalMs,
  LOOP_DONE_MARKER,
  LOOP_INTERVAL_PRESETS,
  stripLoopDoneMarker,
} from '../agentLoop'

describe('agentLoop', () => {
  it('builds a first-iteration prompt with the objective and done marker', () => {
    const prompt = buildLoopPrompt('Ship the loop UI', 1)
    expect(prompt).toContain('Ship the loop UI')
    expect(prompt).toContain(LOOP_DONE_MARKER)
    expect(prompt).toContain('autonomously')
  })

  it('builds a continuation prompt with the iteration number', () => {
    const prompt = buildLoopPrompt('Ship the loop UI', 3)
    expect(prompt).toContain('iteration 3')
    expect(prompt).toContain('Ship the loop UI')
  })

  it('strips the done marker and reports completion', () => {
    expect(stripLoopDoneMarker(`Listo.\n${LOOP_DONE_MARKER}\n`)).toEqual({
      text: 'Listo.',
      done: true,
    })
    expect(stripLoopDoneMarker('Sigo trabajando')).toEqual({
      text: 'Sigo trabajando',
      done: false,
    })
  })

  it('exposes interval presets and formats delay labels', () => {
    expect(LOOP_INTERVAL_PRESETS.map(preset => preset.id)).toEqual([
      '1m', '10m', '30m', '1h', '3h', '6h', '12h',
    ])
    expect(formatLoopIntervalMs(60_000)).toBe('1 min')
    expect(formatLoopIntervalMs(10 * 60_000)).toBe('10 min')
    expect(formatLoopIntervalMs(60 * 60_000)).toBe('1 h')
    expect(formatLoopIntervalMs(12 * 60 * 60_000)).toBe('12 h')
  })
})
