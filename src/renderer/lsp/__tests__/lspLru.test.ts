import { describe, expect, it } from 'vitest'
import { LruIdlePolicy } from '../lru'

function makePolicy(cap = 2, idleMs = 1000): { policy: LruIdlePolicy; stopped: number[] } {
  const stopped: number[] = []
  const policy = new LruIdlePolicy({ cap, idleMs, stop: id => stopped.push(id) })
  return { policy, stopped }
}

describe('LruIdlePolicy', () => {
  it('no desaloja mientras no se pase del tope', () => {
    const { policy, stopped } = makePolicy(2)
    policy.touch(1)
    policy.touch(2)
    expect(stopped).toEqual([])
  })

  it('al pasarse del tope desaloja el inactivo menos usado', () => {
    const { policy, stopped } = makePolicy(2)
    policy.touch(1)
    policy.touch(2)
    policy.release(1, 0)
    policy.release(2, 0)
    policy.touch(3)
    expect(stopped).toEqual([1])
  })

  it('el tope es blando: nunca mata un server con docs abiertos', () => {
    const { policy, stopped } = makePolicy(2)
    policy.touch(1)
    policy.touch(2)
    policy.touch(3) // los tres activos: no hay nada inactivo que desalojar
    expect(stopped).toEqual([])
  })

  it('touch reactiva uno inactivo y lo saca de la mira del barrido', () => {
    const { policy, stopped } = makePolicy(2, 1000)
    policy.touch(1)
    policy.release(1, 0)
    policy.touch(1)
    policy.sweep(10_000)
    expect(stopped).toEqual([])
  })

  it('el barrido para lo que lleva más de idleMs inactivo', () => {
    const { policy, stopped } = makePolicy(4, 1000)
    policy.touch(1)
    policy.touch(2)
    policy.release(1, 0)
    policy.release(2, 5000)
    policy.sweep(2000)
    expect(stopped).toEqual([1])
  })

  it('remove lo olvida y ya no lo barre después', () => {
    const { policy, stopped } = makePolicy(4, 1000)
    policy.touch(1)
    policy.release(1, 0)
    policy.remove(1)
    policy.sweep(10_000)
    expect(stopped).toEqual([])
  })
})
