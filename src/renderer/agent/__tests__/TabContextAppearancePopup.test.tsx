/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars?.query != null ? `${key}:${vars.query}` : key,
  }),
}))

import { TabContextAppearancePopup } from '../TabContextAppearancePopup'

const baseDraft: Pick<TabContext, 'name' | 'kind' | 'icon' | 'color'> = {
  name: 'Notes',
  kind: 'notes',
  icon: 'note',
  color: '#5ec8ff',
}

function Harness({
  initial = baseDraft,
}: {
  initial?: Pick<TabContext, 'name' | 'kind' | 'icon' | 'color'>
}): React.ReactElement {
  const [draft, setDraft] = useState(initial)
  return (
    <TabContextAppearancePopup
      draft={draft}
      onUpdate={patch => setDraft(prev => ({ ...prev, ...patch }))}
    />
  )
}

afterEach(cleanup)

describe('TabContextAppearancePopup', () => {
  it('abre el popup, filtra iconos y conserva selección de icono y color', () => {
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: /tabContexts\.appearance/i })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()

    const search = within(dialog).getByLabelText('tabContexts.iconSearch')
    fireEvent.change(search, { target: { value: 'bug' } })
    expect(within(dialog).getByRole('radio', { name: 'bug' })).toBeTruthy()
    expect(within(dialog).queryByRole('radio', { name: 'note' })).toBeNull()

    fireEvent.click(within(dialog).getByRole('radio', { name: 'bug' }))
    expect(within(dialog).getByRole('radio', { name: 'bug' }).getAttribute('aria-checked')).toBe('true')

    fireEvent.click(within(dialog).getByRole('radio', { name: '#fb7185' }))
    expect(within(dialog).getByRole('radio', { name: '#fb7185' }).getAttribute('aria-checked')).toBe('true')
    // Sigue abierto tras elegir icono/color.
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('cierra con Escape y con clic fuera', () => {
    render(
      <div>
        <Harness />
        <button type="button">outside</button>
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: /tabContexts\.appearance/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('dialog').hasAttribute('data-escape-layer')).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /tabContexts\.appearance/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.mouseDown(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con el popup abierto, Escape no cierra un modal padre que respeta data-escape-layer', () => {
    const onModalClose = vi.fn()
    render(
      <div data-testid="modal-root">
        <Harness />
      </div>,
    )

    // TerminalModal se registra al montar el modal (antes que el popup).
    const modalRoot = screen.getByTestId('modal-root')
    const onModalKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (modalRoot.querySelector('[data-escape-layer]')) return
      onModalClose()
    }
    window.addEventListener('keydown', onModalKey, true)
    try {
      fireEvent.click(screen.getByRole('button', { name: /tabContexts\.appearance/i }))
      expect(screen.getByRole('dialog')).toBeTruthy()

      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onModalClose).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).toBeNull()
    } finally {
      window.removeEventListener('keydown', onModalKey, true)
    }
  })
})
