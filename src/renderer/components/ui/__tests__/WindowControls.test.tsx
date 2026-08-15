/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WindowControls } from '../WindowControls'

afterEach(cleanup)

describe('WindowControls', () => {
  it('renderiza close, min y zoom en ese orden de DOM', () => {
    render(
      <WindowControls
        closeLabel="Close"
        minimizeLabel="Minimize"
        zoomLabel="Zoom"
        onClose={() => {}}
        onMinimize={() => {}}
        onZoom={() => {}}
      />,
    )
    const group = screen.getByRole('group')
    const buttons = Array.from(group.querySelectorAll('button'))
    expect(buttons).toHaveLength(3)
    expect(buttons[0].className).toContain('window-controls__btn--close')
    expect(buttons[1].className).toContain('window-controls__btn--min')
    expect(buttons[2].className).toContain('window-controls__btn--zoom')
    expect(buttons[0].getAttribute('aria-label')).toBe('Close')
    expect(buttons[1].getAttribute('aria-label')).toBe('Minimize')
    expect(buttons[2].getAttribute('aria-label')).toBe('Zoom')
  })

  it('sin handler o con *Disabled deja el botón disabled, tabIndex -1 y aria-hidden', () => {
    const { container } = render(
      <WindowControls
        closeLabel="Close"
        minimizeLabel="Minimize"
        zoomLabel="Zoom"
        onClose={() => {}}
        minimizeDisabled
        zoomDisabled
      />,
    )
    const min = container.querySelector('.window-controls__btn--min') as HTMLButtonElement
    const zoom = container.querySelector('.window-controls__btn--zoom') as HTMLButtonElement
    expect(min.disabled).toBe(true)
    expect(zoom.disabled).toBe(true)
    expect(min.tabIndex).toBe(-1)
    expect(zoom.tabIndex).toBe(-1)
    expect(min.getAttribute('aria-hidden')).toBe('true')
    expect(zoom.getAttribute('aria-hidden')).toBe('true')
  })

  it('stopPropagation en pointerdown y click; onClose en pointerdown', () => {
    const onClose = vi.fn()
    const parentPointer = vi.fn()
    const parentClick = vi.fn()
    render(
      <div onPointerDown={parentPointer} onClick={parentClick}>
        <WindowControls
          closeLabel="Close"
          minimizeLabel="Min"
          zoomLabel="Zoom"
          onClose={onClose}
          onMinimize={() => {}}
          onZoom={() => {}}
        />
      </div>,
    )
    const close = screen.getByLabelText('Close')
    fireEvent.pointerDown(close, { button: 0, bubbles: true })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(parentPointer).not.toHaveBeenCalled()

    onClose.mockClear()
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('aplica groupLabel al role=group', () => {
    render(
      <WindowControls
        groupLabel="Window chrome"
        closeLabel="Close"
        minimizeLabel="Min"
        zoomLabel="Zoom"
        onClose={() => {}}
        onMinimize={() => {}}
        onZoom={() => {}}
      />,
    )
    expect(screen.getByRole('group', { name: 'Window chrome' })).toBeTruthy()
  })

  it('size sm añade window-controls--sm', () => {
    const { container } = render(
      <WindowControls
        size="sm"
        closeLabel="Close"
        minimizeLabel="Min"
        zoomLabel="Zoom"
        onClose={() => {}}
        onMinimize={() => {}}
        onZoom={() => {}}
      />,
    )
    expect(container.querySelector('.window-controls--sm')).toBeTruthy()
  })
})
