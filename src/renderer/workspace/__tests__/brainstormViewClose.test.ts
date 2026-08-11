import { describe, expect, it } from 'vitest'
import {
  isBrainstormLive,
  isBrainstormStoppable,
} from '../brainstormViewClose'

describe('brainstormViewClose', () => {
  it('treats running and idle as stoppable', () => {
    expect(isBrainstormStoppable('running')).toBe(true)
    expect(isBrainstormStoppable('idle')).toBe(true)
    expect(isBrainstormStoppable('done')).toBe(false)
    expect(isBrainstormStoppable('stopped')).toBe(false)
  })

  it('treats paused as live: minimizada sigue mereciendo indicador', () => {
    expect(isBrainstormLive('running')).toBe(true)
    expect(isBrainstormLive('idle')).toBe(true)
    expect(isBrainstormLive('paused')).toBe(true)
    expect(isBrainstormLive('done')).toBe(false)
    expect(isBrainstormLive('stopped')).toBe(false)
  })
})
