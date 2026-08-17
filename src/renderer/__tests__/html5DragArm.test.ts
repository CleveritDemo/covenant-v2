/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import {
  allowArmedHtml5DragStart,
  armHtml5DragOnMouseDown,
  createHtml5DragArm,
  disarmHtml5Drag,
} from '../html5DragArm'

describe('html5DragArm', () => {
  it('arma draggable en mousedown primario y desarma en mouseup', () => {
    const el = document.createElement('div')
    const arm = createHtml5DragArm()
    const add = vi.spyOn(window, 'addEventListener')

    armHtml5DragOnMouseDown(el, arm, 0)
    expect(arm.current).toBe(true)
    expect(el.draggable).toBe(true)
    expect(add).toHaveBeenCalledWith(
      'mouseup',
      expect.any(Function),
      expect.objectContaining({ capture: true, once: true }),
    )

    const handler = add.mock.calls.find(c => c[0] === 'mouseup')?.[1] as () => void
    handler()
    expect(arm.current).toBe(false)
    expect(el.draggable).toBe(false)
  })

  it('ignora botones que no son el primario', () => {
    const el = document.createElement('div')
    const arm = createHtml5DragArm()
    armHtml5DragOnMouseDown(el, arm, 2)
    expect(arm.current).toBe(false)
    expect(el.draggable).toBe(false)
  })

  it('rechaza dragStart si no está armado', () => {
    const el = document.createElement('div')
    el.draggable = true
    const arm = createHtml5DragArm()
    const preventDefault = vi.fn()
    expect(allowArmedHtml5DragStart(el, arm, preventDefault)).toBe(false)
    expect(preventDefault).toHaveBeenCalled()
    expect(el.draggable).toBe(false)
  })

  it('disarm limpia arm y atributo', () => {
    const el = document.createElement('div')
    const arm = createHtml5DragArm()
    armHtml5DragOnMouseDown(el, arm, 0)
    disarmHtml5Drag(el, arm)
    expect(arm.current).toBe(false)
    expect(el.draggable).toBe(false)
  })
})
