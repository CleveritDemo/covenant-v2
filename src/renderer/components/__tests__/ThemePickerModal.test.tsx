/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { ThemePickerModal } from '../ThemePickerModal'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${Object.values(params).join(',')}` : key,
  }),
}))

vi.mock('../TerminalModal', () => ({
  TerminalModal: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <div>{children}<div>{footer}</div></div>
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
      musicVolume={CONFIG_DEFAULTS.musicVolume}
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
  it('el slider llama onAudioConfigChange con musicVolume 0..1', () => {
    const { onAudioConfigChange } = renderPicker()

    fireEvent.change(document.getElementById('theme-picker-music-volume') as HTMLInputElement, {
      target: { value: '70' },
    })

    expect(onAudioConfigChange).toHaveBeenCalledWith({ musicVolume: 0.7 })
  })

  it('el toggle llama onAudioConfigChange con musicEnabled', () => {
    const { onAudioConfigChange } = renderPicker()

    fireEvent.click(screen.getByRole('switch', { name: 'themePicker.audioToggle' }))

    expect(onAudioConfigChange).toHaveBeenCalledWith({ musicEnabled: false })
  })

  it('muestra el porcentaje de volumen actual', () => {
    renderPicker({ musicVolume: 0.42 })

    expect(screen.getByText('42%')).toBeTruthy()
    expect((document.getElementById('theme-picker-music-volume') as HTMLInputElement).value).toBe('42')
  })

  it('el slider sigue usable con audio off', () => {
    const { onAudioConfigChange } = renderPicker({ musicEnabled: false })
    const slider = document.getElementById('theme-picker-music-volume') as HTMLInputElement
    expect(slider.disabled).toBe(false)

    fireEvent.change(slider, { target: { value: '55' } })
    expect(onAudioConfigChange).toHaveBeenCalledWith({ musicVolume: 0.55 })
  })
})

describe('ThemePickerModal keyboard guards', () => {
  it('Enter desde el slider no selecciona tema', () => {
    const { onSelectTheme } = renderPicker()
    const slider = document.getElementById('theme-picker-music-volume') as HTMLInputElement
    fireEvent.keyDown(slider, { key: 'Enter', bubbles: true })
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
