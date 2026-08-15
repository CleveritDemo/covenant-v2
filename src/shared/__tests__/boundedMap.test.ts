import { describe, expect, it } from 'vitest'
import { COVENANT_REQUEST_LIMIT, mapWithConcurrency } from '../boundedMap'

describe('COVENANT_REQUEST_LIMIT', () => {
  it('coincide con el gate del main (4)', () => {
    expect(COVENANT_REQUEST_LIMIT).toBe(4)
  })
})

describe('mapWithConcurrency', () => {
  it('preserva el orden del array de salida', async () => {
    const items = [10, 20, 30, 40]
    const out = await mapWithConcurrency(items, 2, async (n, i) => {
      await new Promise(r => setTimeout(r, (items.length - i) * 5))
      return n * 2
    })
    expect(out).toEqual([20, 40, 60, 80])
  })

  it('nunca corre más de `limit` promesas a la vez', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = Array.from({ length: 12 }, (_, i) => i)
    await mapWithConcurrency(items, 3, async n => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(r => setTimeout(r, 8))
      inFlight -= 1
      return n
    })
    expect(maxInFlight).toBeLessThanOrEqual(3)
    expect(maxInFlight).toBe(3)
  })

  it('trata limit <= 0 como 1', async () => {
    let inFlight = 0
    let maxInFlight = 0
    await mapWithConcurrency([1, 2, 3], 0, async n => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(r => setTimeout(r, 5))
      inFlight -= 1
      return n
    })
    expect(maxInFlight).toBe(1)
  })

  it('propaga el primer reject (semántica Promise.all)', async () => {
    const items = [1, 2, 3, 4]
    await expect(
      mapWithConcurrency(items, 2, async n => {
        if (n === 3) throw new Error(`boom-${n}`)
        await new Promise(r => setTimeout(r, 5))
        return n
      }),
    ).rejects.toThrow('boom-3')
  })
})
