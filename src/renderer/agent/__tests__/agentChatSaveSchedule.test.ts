import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelAgentChatSave,
  createAgentChatSaveSchedule,
  flushAgentChatSave,
  resetAgentChatSaveScheduleForTests,
  scheduleAgentChatSave,
} from '../agentChatSaveSchedule'

describe('agentChatSaveSchedule', () => {
  beforeEach(() => {
    resetAgentChatSaveScheduleForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetAgentChatSaveScheduleForTests()
  })

  it('debounces trailing save', () => {
    vi.useFakeTimers()
    const save = vi.fn()

    scheduleAgentChatSave(save, 500)
    scheduleAgentChatSave(save, 500)
    expect(save).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush cancels the timer', () => {
    vi.useFakeTimers()
    const save = vi.fn()

    scheduleAgentChatSave(save, 500)
    flushAgentChatSave()
    expect(save).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(500)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('flush saves the latest payload', () => {
    vi.useFakeTimers()
    const first = vi.fn()
    const second = vi.fn()

    scheduleAgentChatSave(first, 500)
    scheduleAgentChatSave(second, 500)
    flushAgentChatSave()

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('cancel discards without saving', () => {
    vi.useFakeTimers()
    const save = vi.fn()

    scheduleAgentChatSave(save, 500)
    cancelAgentChatSave()

    vi.advanceTimersByTime(500)
    expect(save).not.toHaveBeenCalled()
  })

  it('createAgentChatSaveSchedule isolates instances', () => {
    vi.useFakeTimers()
    const a = createAgentChatSaveSchedule()
    const b = createAgentChatSaveSchedule()
    const saveA = vi.fn()
    const saveB = vi.fn()

    a.schedule(saveA, 500)
    b.schedule(saveB, 500)

    vi.advanceTimersByTime(500)
    expect(saveA).toHaveBeenCalledTimes(1)
    expect(saveB).toHaveBeenCalledTimes(1)
  })
})
