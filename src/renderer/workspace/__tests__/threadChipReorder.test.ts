/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  THREAD_CHIP_REORDER_MS,
  animateThreadChipReorder,
  threadChipReorderReducedMotion,
} from '../threadChipReorder'

afterEach(() => {
  document.documentElement.removeAttribute('data-reduce-motion')
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('threadChipReorder', () => {
  it('threadChipReorderReducedMotion respeta data-reduce-motion', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    expect(threadChipReorderReducedMotion()).toBe(true)
  })

  it('animateThreadChipReorder anima dx cuando un chip cambia de left', () => {
    const root = document.createElement('div')
    const a = document.createElement('span')
    a.dataset.threadChipId = 't-a'
    const b = document.createElement('span')
    b.dataset.threadChipId = 't-b'
    root.append(a, b)
    document.body.append(root)

    const animateA = vi.fn()
    const animateB = vi.fn()
    a.animate = animateA as unknown as typeof a.animate
    b.animate = animateB as unknown as typeof b.animate

    vi.spyOn(a, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 0,
      right: 80,
      bottom: 20,
      width: 40,
      height: 20,
      x: 40,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)
    vi.spyOn(b, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 0,
      right: 140,
      bottom: 20,
      width: 40,
      height: 20,
      x: 100,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    const next = animateThreadChipReorder(
      root,
      new Map([
        ['t-a', 100],
        ['t-b', 40],
      ]),
    )

    expect(next.get('t-a')).toBe(40)
    expect(next.get('t-b')).toBe(100)
    expect(animateA).toHaveBeenCalledTimes(1)
    expect(animateB).toHaveBeenCalledTimes(1)
    const framesA = animateA.mock.calls[0]![0] as Keyframe[]
    expect(framesA[0]).toEqual({ transform: 'translateX(60px)' })
    expect(framesA[1]).toEqual({ transform: 'translateX(0)' })
    expect(animateA.mock.calls[0]![1]).toMatchObject({
      duration: THREAD_CHIP_REORDER_MS,
    })
  })

  it('animateThreadChipReorder no anima con reduce-motion', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    const root = document.createElement('div')
    const a = document.createElement('span')
    a.dataset.threadChipId = 't-a'
    root.append(a)
    document.body.append(root)
    const animate = vi.fn()
    a.animate = animate as unknown as typeof a.animate
    vi.spyOn(a, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 10,
      bottom: 10,
      width: 10,
      height: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    animateThreadChipReorder(root, new Map([['t-a', 80]]))
    expect(animate).not.toHaveBeenCalled()
  })
})
