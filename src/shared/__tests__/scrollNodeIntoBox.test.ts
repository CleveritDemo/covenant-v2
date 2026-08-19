import { describe, expect, it } from 'vitest'
import { scrollTopToCenter } from '../scrollNodeIntoBox'

describe('scrollTopToCenter', () => {
  it('centra un nodo a media caja', () => {
    const box = { scrollTop: 100, clientHeight: 200, scrollHeight: 1000 }
    expect(scrollTopToCenter(box, 150, 50)).toBe(175)
  })

  it('acota por abajo a 0 cuando el resultado sería negativo', () => {
    const box = { scrollTop: 50, clientHeight: 200, scrollHeight: 1000 }
    expect(scrollTopToCenter(box, 0, 20)).toBe(0)
  })

  it('acota por arriba a scrollHeight - clientHeight', () => {
    const box = { scrollTop: 800, clientHeight: 200, scrollHeight: 1000 }
    expect(scrollTopToCenter(box, 180, 20)).toBe(800)
  })
})
