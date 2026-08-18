/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
import { ThemePickerTrigger } from '../ThemePickerTrigger'
import { Titlebar } from '../Titlebar'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('../TitlebarMusicControls', () => ({
  TitlebarMusicControls: () => null,
}))

vi.mock('../UpdateBanner', () => ({
  UpdateBanner: () => null,
}))

afterEach(() => {
  cleanup()
})

describe('ThemePickerTrigger', () => {
  it('usa Button del UI kit con swatches y a11y del diálogo', () => {
    const onClick = vi.fn()
    render(
      <ThemePickerTrigger
        themeId="matrix"
        themeName="Matrix"
        isOpen={false}
        onClick={onClick}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'themePicker.triggerTitle' })
    expect(trigger.className).toMatch(/\bbtn\b/)
    expect(trigger.className).toMatch(/\bbtn--ghost\b/)
    expect(trigger.className).toMatch(/\bbtn--sm\b/)
    expect(trigger.getAttribute('aria-haspopup') === 'dialog').toBe(true)
    expect(trigger.getAttribute('aria-expanded') === 'false').toBe(true)
    expect(trigger.querySelector('.theme-picker-trigger-palette')).toBeTruthy()
    expect(trigger.querySelector('.theme-picker-trigger-label')?.textContent).toBe('Matrix')

    fireEvent.click(trigger)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Titlebar icon buttons', () => {
  it('org y settings son icon buttons sm cuadrados', () => {
    render(
      <Titlebar
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix' }}
        fontSize={14}
        fontSizeMin={10}
        fontSizeMax={24}
        themePickerOpen={false}
        onFontIncrease={() => {}}
        onFontDecrease={() => {}}
        onOpenThemePicker={() => {}}
        onOpenOrganizations={() => {}}
        onOpenSettings={() => {}}
      />,
    )

    const org = screen.getByRole('button', { name: 'titlebar.organizationsAriaLabel' })
    const settings = screen.getByRole('button', { name: 'titlebar.settingsAriaLabel' })

    for (const btn of [org, settings]) {
      expect(btn.className).toMatch(/\bbtn--icon\b/)
      expect(btn.className).toMatch(/\bbtn--sm\b/)
    }
  })

  it('hideOrganizations=true oculta Organizations y deja Settings', () => {
    render(
      <Titlebar
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix' }}
        fontSize={14}
        fontSizeMin={10}
        fontSizeMax={24}
        themePickerOpen={false}
        hideOrganizations
        onFontIncrease={() => {}}
        onFontDecrease={() => {}}
        onOpenThemePicker={() => {}}
        onOpenOrganizations={() => {}}
        onOpenSettings={() => {}}
      />,
    )

    expect(screen.queryByRole('button', { name: 'titlebar.organizationsAriaLabel' })).toBeNull()
    expect(screen.getByRole('button', { name: 'titlebar.settingsAriaLabel' })).toBeTruthy()
  })
})
