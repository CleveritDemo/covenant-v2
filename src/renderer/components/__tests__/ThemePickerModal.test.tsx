/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { APP_CHROME_MODAL_Z, APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { ThemePickerModal } from '../ThemePickerModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

vi.mock('../TerminalModal', () => ({
  TerminalModal: ({
    children,
    footer,
    zIndex,
  }: {
    children: React.ReactNode
    footer?: React.ReactNode
    zIndex?: number
  }) => (
    <div className="terminal-modal-root" style={{ '--modal-z': zIndex } as React.CSSProperties}>
      {children}<div>{footer}</div>
    </div>
  ),
}))

afterEach(cleanup)

function renderPicker(overrides: Partial<React.ComponentProps<typeof ThemePickerModal>> = {}) {
  const onSelectTheme = vi.fn()
  const onAudioConfigChange = vi.fn()
  render(
    <ThemePickerModal
      open
      currentThemeId={CONFIG_DEFAULTS.themeId}
      musicEnabled
      onSelectTheme={onSelectTheme}
      onAudioConfigChange={onAudioConfigChange}
      onClose={() => {}}
      {...overrides}
    />,
  )
  return { onSelectTheme, onAudioConfigChange }
}

describe('ThemePickerModal preview', () => {
  it('muestra mini Covenant sin mock de terminal', () => {
    renderPicker()
    const preview = document.querySelector('.theme-picker-preview--app')
    expect(preview).toBeTruthy()
    expect(preview?.textContent ?? '').not.toMatch(/\buser\b/)
    expect(preview?.textContent ?? '').not.toMatch(/\bhost\b/)
    expect(preview?.textContent ?? '').not.toContain('ls -la')
    expect(document.querySelector('.theme-picker-tp-term')).toBeNull()
    expect(document.querySelector('.theme-picker-tp-workspace')).toBeTruthy()
    expect(document.querySelector('.theme-picker-tp-dock')).toBeTruthy()
  })

  it('el tema activo muestra badge inUse y no asterisco', () => {
    renderPicker()
    const preview = document.querySelector('.theme-picker-preview--app') as HTMLElement
    expect(within(preview).getByText('themePicker.inUse')).toBeTruthy()
    expect(preview.textContent ?? '').not.toContain('*')
  })
})

describe('ThemePickerModal cards', () => {
  it('las cards exponen selección y click', () => {
    const { onSelectTheme } = renderPicker()
    const listbox = screen.getByRole('listbox', { name: 'themePicker.listAriaLabel' })
    const options = within(listbox).getAllByRole('option')
    expect(options.length).toBeGreaterThan(1)

    const active = options.find(el => el.getAttribute('aria-selected') === 'true')
    expect(active).toBeTruthy()
    expect(active?.querySelector('.theme-picker-chip-check')).toBeTruthy()
    expect(active?.querySelectorAll('.theme-picker-chip-orb').length).toBe(4)

    const other = options.find(el => el.getAttribute('aria-selected') !== 'true')
    expect(other).toBeTruthy()
    fireEvent.click(other!)
    expect(onSelectTheme).toHaveBeenCalled()
  })
})

describe('ThemePickerModal audio', () => {
  it('el toggle llama onAudioConfigChange con musicEnabled', () => {
    const { onAudioConfigChange } = renderPicker()

    fireEvent.click(screen.getByRole('switch', { name: 'themePicker.audioToggle' }))

    expect(onAudioConfigChange).toHaveBeenCalledWith({ musicEnabled: false })
  })

  it('no muestra slider ni porcentaje de volumen', () => {
    renderPicker()
    expect(document.getElementById('theme-picker-music-volume')).toBeNull()
    expect(document.querySelector('.theme-picker-audio__slider')).toBeNull()
    expect(document.querySelector('.theme-picker-audio__value')).toBeNull()
  })
})

describe('ThemePickerModal keyboard guards', () => {
  it('Enter desde el toggle de audio no selecciona tema', () => {
    const { onSelectTheme } = renderPicker()
    const toggle = screen.getByRole('switch', { name: 'themePicker.audioToggle' })
    fireEvent.keyDown(toggle, { key: 'Enter', bubbles: true })
    expect(onSelectTheme).not.toHaveBeenCalled()
  })

  it('ArrowRight desde el search no mueve el foco del picker', () => {
    renderPicker()
    const search = screen.getByRole('searchbox', { name: 'themePicker.filterAriaLabel' })
    const before = document.querySelector('.theme-picker-chip--focus')?.getAttribute('aria-label')
    fireEvent.keyDown(search, { key: 'ArrowRight', bubbles: true })
    const after = document.querySelector('.theme-picker-chip--focus')?.getAttribute('aria-label')
    expect(after).toBe(before)
  })
})

describe('ThemePickerModal z-index', () => {
  it('APP_CHROME_MODAL_Z queda entre overlays del plano y Settings', () => {
    expect(APP_CHROME_MODAL_Z).toBeGreaterThan(APP_OVERLAY_MODAL_Z)
    expect(APP_CHROME_MODAL_Z).toBeLessThan(720)
  })

  it('el portal declara --modal-z en APP_CHROME_MODAL_Z', () => {
    renderPicker()
    const root = document.querySelector('.terminal-modal-root') as HTMLElement | null
    expect(root).toBeTruthy()
    expect(root!.style.getPropertyValue('--modal-z').trim()).toBe(String(APP_CHROME_MODAL_Z))
  })
})
