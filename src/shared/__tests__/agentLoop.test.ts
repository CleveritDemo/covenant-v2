import { describe, expect, it } from 'vitest'
import { buildLoopPrompt, LOOP_DONE_MARKER, stripLoopDoneMarker } from '../agentLoop'

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
})
