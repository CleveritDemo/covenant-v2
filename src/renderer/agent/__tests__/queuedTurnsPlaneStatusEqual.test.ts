import { describe, expect, it } from 'vitest'
import { queuedTurnsPlaneStatusEqual } from '../agentPlaneStatusIdle'

describe('queuedTurnsPlaneStatusEqual', () => {
  const base = [{
    id: 'q1',
    text: 'hola',
    images: [{ id: 'i1', previewUrl: 'blob:pending', name: 'a.png' }],
  }]

  it('returns false when previewUrl changes (async thumbnail refresh)', () => {
    const previous = base
    const next = [{
      ...base[0],
      images: [{ id: 'i1', previewUrl: 'data:image/webp;base64,thumb', name: 'a.png' }],
    }]
    expect(queuedTurnsPlaneStatusEqual(previous, next)).toBe(false)
  })

  it('returns true when id, text, length and previewUrl match', () => {
    expect(queuedTurnsPlaneStatusEqual(base, base)).toBe(true)
    expect(queuedTurnsPlaneStatusEqual(undefined, [])).toBe(true)
  })
})
