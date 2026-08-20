/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { Select, type SelectOption } from '../Select'

afterEach(cleanup)

const here = dirname(fileURLToPath(import.meta.url))

const OPTIONS: SelectOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
]

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

function dispatchBeforeToggle(panel: HTMLElement, newState: 'open' | 'closed'): void {
  panel.dispatchEvent(Object.assign(new Event('beforetoggle'), { newState }))
}

describe('Select panel beforetoggle placement', () => {
  it('posiciona el panel debajo del disparador cuando hay espacio', () => {
    render(<Select value="a" options={OPTIONS} onChange={() => {}} />)
    mockTriggerBox({ top: 100, bottom: 132, left: 80, width: 240 })
    const panel = screen.getByRole('listbox', { hidden: true }) as HTMLElement

    act(() => {
      dispatchBeforeToggle(panel, 'open')
    })

    expect(panel.style.top).toBe('136px')
    expect(panel.style.bottom).toBe('auto')
    expect(panel.style.left).toBe('80px')
    expect(panel.style.right).toBe('auto')
    expect(panel.dataset.placed).toBe('true')
  })

  it('posiciona el panel encima anclado al disparador, no al techo del viewport', () => {
    render(<Select value="a" options={OPTIONS} onChange={() => {}} />)
    mockTriggerBox({ top: 700, bottom: 732, left: 80, width: 240 })
    const panel = screen.getByRole('listbox', { hidden: true }) as HTMLElement

    act(() => {
      dispatchBeforeToggle(panel, 'open')
    })

    // below = 800-732-8 = 60 < 180 → abre hacia arriba; bottom = 800-700+4
    expect(panel.style.bottom).toBe('104px')
    expect(panel.style.top).toBe('auto')
    expect(panel.style.left).toBe('80px')
    expect(panel.dataset.placed).toBe('true')
  })

  it('limpia data-placed al cerrar con beforetoggle closed', () => {
    render(<Select value="a" options={OPTIONS} onChange={() => {}} />)
    mockTriggerBox({ top: 100, bottom: 132, left: 80, width: 240 })
    const panel = screen.getByRole('listbox', { hidden: true }) as HTMLElement

    act(() => {
      dispatchBeforeToggle(panel, 'open')
    })

    expect(panel.style.top).toBe('136px')
    expect(panel.style.left).toBe('80px')
    expect(panel.dataset.placed).toBe('true')

    act(() => {
      dispatchBeforeToggle(panel, 'closed')
    })

    expect(panel.dataset.placed).toBeUndefined()
  })

  it('Select.css oculta el panel sin data-placed', () => {
    const css = readFileSync(join(here, '../Select.css'), 'utf8')
    expect(css).toMatch(/\.select-panel:not\(\[data-placed\]\)\s*\{[^}]*visibility:\s*hidden/)
  })
})
