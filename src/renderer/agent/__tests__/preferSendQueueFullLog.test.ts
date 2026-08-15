import { describe, expect, it } from 'vitest'
import { shouldLogPreferSendQueueFull } from '../preferSendQueueFullLog'

describe('shouldLogPreferSendQueueFull', () => {
  it('allows one warn per sendId', () => {
    const logged = new Set<string>()
    expect(shouldLogPreferSendQueueFull('send-1', logged)).toBe(true)
    expect(shouldLogPreferSendQueueFull('send-1', logged)).toBe(false)
    expect(shouldLogPreferSendQueueFull('send-2', logged)).toBe(true)
  })

  it('logs when sendId is missing', () => {
    const logged = new Set<string>()
    expect(shouldLogPreferSendQueueFull(undefined, logged)).toBe(true)
    expect(shouldLogPreferSendQueueFull('  ', logged)).toBe(true)
  })
})
