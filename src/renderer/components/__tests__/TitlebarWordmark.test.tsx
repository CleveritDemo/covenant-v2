/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CONFIG_DEFAULTS } from '@shared/configSchema'
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

const here = dirname(fileURLToPath(import.meta.url))

function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return css.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`))?.[0] ?? ''
}

afterEach(() => {
  cleanup()
})

describe('Titlebar wordmark', () => {
  it('renderiza Covenant centrado con aria-hidden', () => {
    const { container } = render(
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

    const wordmark = container.querySelector('.titlebar__wordmark')
    expect(wordmark).toBeTruthy()
    expect(wordmark?.textContent).toBe('Covenant')
    expect(wordmark?.getAttribute('aria-hidden')).toBe('true')
    expect(wordmark?.classList.contains('titlebar__wordmark--offline')).toBe(false)
  })

  it('con offline muestra punto atenuado sin texto de error', () => {
    const { container } = render(
      <Titlebar
        config={{ ...CONFIG_DEFAULTS, themeId: 'matrix' }}
        fontSize={14}
        fontSizeMin={10}
        fontSizeMax={24}
        themePickerOpen={false}
        offline
        onFontIncrease={() => {}}
        onFontDecrease={() => {}}
        onOpenThemePicker={() => {}}
        onOpenOrganizations={() => {}}
        onOpenSettings={() => {}}
      />,
    )

    const wordmark = container.querySelector('.titlebar__wordmark')
    expect(wordmark?.classList.contains('titlebar__wordmark--offline')).toBe(true)
    expect(container.querySelector('.titlebar__wordmark-dot')).toBeTruthy()
    expect(wordmark?.textContent).toBe('Covenant')
    expect(wordmark?.getAttribute('aria-hidden')).toBeNull()
    expect(wordmark?.getAttribute('role')).toBe('status')
    expect(wordmark?.getAttribute('aria-live')).toBe('polite')

    const visible = (wordmark?.textContent ?? '').toLowerCase()
    expect(visible).not.toMatch(/err|error|offline/)
  })

  it('Titlebar.css offline no rompe geometría ni usa colores de error', () => {
    const css = readFileSync(join(here, '../Titlebar.css'), 'utf8')
    const offline = block(css, '.titlebar__wordmark--offline')
    const lower = offline.toLowerCase()

    expect(offline.length).toBeGreaterThan(0)
    expect(lower).not.toMatch(/\bposition\s*:/)
    expect(lower).not.toMatch(/\bleft\s*:/)
    expect(lower).not.toMatch(/\btransform\s*:/)
    expect(lower).not.toMatch(/\bred\b|#f|--danger|crimson/)
  })

  it('Titlebar.css oculta el wordmark con update banner y corrige win32', () => {
    const css = readFileSync(join(here, '../Titlebar.css'), 'utf8')
    const updateHide = block(css, '.titlebar:has(.update-banner) .titlebar__wordmark')
    const win32 = block(css, ':root[data-platform="win32"] .titlebar__wordmark')

    expect(updateHide).toMatch(/display:\s*none/)
    expect(win32).toMatch(/left:\s*calc\(50%\s*-\s*73px\)/)
  })
})
