/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Select, type SelectOption } from '../Select'

/** jsdom no implementa Popover API: polyfill mínimo + evento `toggle`. */
beforeAll(() => {
  const proto = HTMLElement.prototype as HTMLElement & {
    showPopover: () => void
    hidePopover: () => void
    togglePopover: () => boolean
  }

  const dispatchToggle = (el: HTMLElement, newState: 'open' | 'closed'): void => {
    el.dispatchEvent(Object.assign(new Event('toggle'), { newState }))
  }

  proto.showPopover = function showPopover(this: HTMLElement) {
    this.setAttribute('data-open', '')
    dispatchToggle(this, 'open')
  }
  proto.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute('data-open')
    dispatchToggle(this, 'closed')
  }
  proto.togglePopover = function togglePopover(this: HTMLElement) {
    if (this.hasAttribute('data-open')) {
      this.hidePopover()
      return false
    }
    this.showPopover()
    return true
  }
})

afterEach(cleanup)

const OPTIONS: SelectOption[] = [
  { value: '', label: 'Default' },
  { value: 'codex-5.3', label: 'Codex 5.3', hint: 'codex-5.3' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
]

/** El panel no se abre solo en jsdom: se dispara el toggle como lo haría el navegador. */
function openPanel(): HTMLElement {
  const panel = screen.getByRole('listbox', { hidden: true })
  // act(): el listener nativo actualiza estado y el handler de teclas debe verlo.
  act(() => {
    panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }))
  })
  return panel
}

describe('Select', () => {
  it('muestra la etiqueta de la opción activa, no su value', () => {
    render(<Select value="codex-5.3" options={OPTIONS} onChange={() => {}} />)
    expect(screen.getByRole('button').textContent).toContain('Codex 5.3')
  })

  it('cae al placeholder cuando el value no está entre las opciones', () => {
    render(<Select value="inventado" options={OPTIONS} onChange={() => {}} placeholder="Elige" />)
    expect(screen.getByRole('button').textContent).toContain('Elige')
  })

  it('marca como seleccionada sólo la opción activa', () => {
    render(<Select value="gpt-5.2" options={OPTIONS} onChange={() => {}} />)
    const selected = screen.getAllByRole('option', { hidden: true })
      .filter(o => o.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0].textContent).toContain('GPT-5.2')
  })

  it('un clic elige la opción y cierra el panel', () => {
    const onChange = vi.fn()
    render(<Select value="" options={OPTIONS} onChange={onChange} />)
    const panel = openPanel()
    act(() => {
      panel.showPopover()
    })
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')

    fireEvent.pointerDown(screen.getByText('GPT-5.2'))
    fireEvent.click(screen.getByText('GPT-5.2'))

    expect(onChange).toHaveBeenCalledWith('gpt-5.2')
    expect(panel.hasAttribute('data-open')).toBe(false)
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false')
  })

  it('Enter confirma la opción activa y cierra el panel', () => {
    const onChange = vi.fn()
    render(<Select value="" options={OPTIONS} onChange={onChange} />)
    const panel = openPanel()
    act(() => {
      panel.showPopover()
    })

    fireEvent.keyDown(panel, { key: 'ArrowDown' })
    fireEvent.keyDown(panel, { key: 'ArrowDown' })
    fireEvent.keyDown(panel, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('gpt-5.2')
    expect(panel.hasAttribute('data-open')).toBe(false)
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false')
  })

  it('las flechas mueven el cursor y Enter confirma', () => {
    const onChange = vi.fn()
    render(<Select value="" options={OPTIONS} onChange={onChange} />)
    const panel = openPanel()

    fireEvent.keyDown(panel, { key: 'ArrowDown' })
    fireEvent.keyDown(panel, { key: 'ArrowDown' })
    fireEvent.keyDown(panel, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('gpt-5.2')
  })

  it('el cursor arranca en la opción seleccionada, no en la primera', () => {
    const onChange = vi.fn()
    render(<Select value="gpt-5.2" options={OPTIONS} onChange={onChange} />)
    const panel = openPanel()

    fireEvent.keyDown(panel, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('gpt-5.2')
  })

  it('el cursor no se sale de la lista', () => {
    const onChange = vi.fn()
    render(<Select value="" options={OPTIONS} onChange={onChange} />)
    const panel = openPanel()

    for (let i = 0; i < 10; i++) fireEvent.keyDown(panel, { key: 'ArrowUp' })
    fireEvent.keyDown(panel, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('')

    for (let i = 0; i < 10; i++) fireEvent.keyDown(panel, { key: 'ArrowDown' })
    fireEvent.keyDown(panel, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('gpt-5.2')
  })

  it('los atributos del popover llegan al DOM', () => {
    render(<Select value="" options={OPTIONS} onChange={() => {}} />)
    const trigger = screen.getByRole('button')
    const panel = screen.getByRole('listbox', { hidden: true })
    // Regresión: en camelCase React 18 descarta popovertarget y el panel nunca abre.
    expect(trigger.getAttribute('popovertarget')).toBe(panel.id)
    expect(panel.getAttribute('popover')).toBe('auto')
  })

  it('el disparador queda deshabilitado y anuncia el estado del panel', () => {
    render(<Select value="" options={OPTIONS} onChange={() => {}} disabled />)
    const trigger = screen.getByRole('button')
    expect(trigger.hasAttribute('disabled')).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
  })

  it('muestra el dot busy solo en las opciones marcadas', () => {
    const busyOptions: SelectOption[] = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta', busy: true },
      { value: 'c', label: 'Gamma' },
    ]
    render(<Select value="a" options={busyOptions} onChange={() => {}} />)
    const panel = openPanel()
    act(() => {
      panel.showPopover()
    })

    const dots = panel.querySelectorAll('.select-panel__busy-dot')
    expect(dots).toHaveLength(1)
    expect(dots[0]?.closest('[role="option"]')?.textContent).toContain('Beta')
  })

  it('abre debajo del disparador cuando hay espacio', () => {
    render(<Select value="" options={OPTIONS} onChange={() => {}} />)
    mockTriggerBox({ top: 100, bottom: 132, left: 80, width: 240 })
    const panel = openPanel()
    expect(panel.style.top).toBe('136px')
    expect(panel.style.bottom).toBe('auto')
    expect(panel.style.left).toBe('80px')
    expect(panel.style.right).toBe('auto')
  })

  it('abre encima anclado al disparador, no al techo del viewport', () => {
    render(<Select value="" options={OPTIONS} onChange={() => {}} />)
    mockTriggerBox({ top: 700, bottom: 732, left: 80, width: 240 })
    const panel = openPanel()
    // below = 800-732-8 = 60 < 180 → abre hacia arriba; bottom = 800-700+4
    expect(panel.style.bottom).toBe('104px')
    expect(panel.style.top).toBe('auto')
    expect(panel.style.left).toBe('80px')
  })
})

const VIEWPORT = { innerHeight: 800, innerWidth: 1200 }

function mockTriggerBox(box: { top: number; bottom: number; left: number; width: number }): void {
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT.innerHeight, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT.innerWidth, configurable: true })
  const trigger = screen.getByRole('button')
  vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
    top: box.top,
    bottom: box.bottom,
    left: box.left,
    right: box.left + box.width,
    width: box.width,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
    toJSON: () => ({}),
  })
}
