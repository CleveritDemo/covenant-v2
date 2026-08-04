import { describe, expect, it, vi } from 'vitest'
import {
  isBrainstormStoppable,
  stopBrainstormIfActive,
} from '../brainstormViewClose'

describe('brainstormViewClose', () => {
  it('treats running and idle as stoppable', () => {
    expect(isBrainstormStoppable('running')).toBe(true)
    expect(isBrainstormStoppable('idle')).toBe(true)
    expect(isBrainstormStoppable('done')).toBe(false)
    expect(isBrainstormStoppable('stopped')).toBe(false)
  })

  it('calls stopBrainstorm when closing while running', () => {
    const stop = vi.fn()
    const didStop = stopBrainstormIfActive({
      status: 'running',
      roomId: 'room-1',
      alreadyStopped: false,
      stop,
    })
    expect(didStop).toBe(true)
    expect(stop).toHaveBeenCalledTimes(1)
    expect(stop).toHaveBeenCalledWith('room-1')
  })

  it('calls stopBrainstorm when closing while idle', () => {
    const stop = vi.fn()
    expect(stopBrainstormIfActive({
      status: 'idle',
      roomId: 'room-2',
      alreadyStopped: false,
      stop,
    })).toBe(true)
    expect(stop).toHaveBeenCalledWith('room-2')
  })

  it('does not call stopBrainstorm when status is done or stopped', () => {
    const stop = vi.fn()
    expect(stopBrainstormIfActive({
      status: 'done',
      roomId: 'room-3',
      alreadyStopped: false,
      stop,
    })).toBe(false)
    expect(stopBrainstormIfActive({
      status: 'stopped',
      roomId: 'room-3',
      alreadyStopped: false,
      stop,
    })).toBe(false)
    expect(stop).not.toHaveBeenCalled()
  })

  it('skips redundant stop when alreadyStopped', () => {
    const stop = vi.fn()
    expect(stopBrainstormIfActive({
      status: 'running',
      roomId: 'room-4',
      alreadyStopped: true,
      stop,
    })).toBe(true)
    expect(stop).not.toHaveBeenCalled()
  })
})
