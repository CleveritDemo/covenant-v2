/**
 * @vitest-environment jsdom
 */
import React, { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { TabContext } from '@shared/tabContext'
import { TerminalModal } from '../../components/TerminalModal'

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
  it('abre el modal en portal, filtra iconos y conserva selección de icono y color', () => {
    render(<Harness />)

    const trigger = screen.getByRole('button', { name: /tabContexts\.appearance/i })
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeTruthy()
    expect(dialog.closest('.terminal-modal-root')).toBeTruthy()
    expect(document.body.contains(dialog)).toBe(true)

    const search = within(dialog).getByLabelText('tabContexts.iconSearch')
    fireEvent.change(search, { target: { value: 'bug' } })
    expect(within(dialog).getByRole('radio', { name: 'bug' })).toBeTruthy()
    expect(within(dialog).queryByRole('radio', { name: 'note' })).toBeNull()

    fireEvent.click(within(dialog).getByRole('radio', { name: 'bug' }))
    expect(within(dialog).getByRole('radio', { name: 'bug' }).getAttribute('aria-checked')).toBe('true')

    fireEvent.click(within(dialog).getByRole('radio', { name: '#fb7185' }))
    expect(within(dialog).getByRole('radio', { name: '#fb7185' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('cierra con Escape y con el traffic de cierre', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: /tabContexts\.appearance/i }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('dialog').closest('.terminal-modal-root')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /tabContexts\.appearance/i }))
    fireEvent.click(screen.getByRole('button', { name: 'ui.closeAriaLabel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Escape cierra solo el modal de Aspecto, no el formulario padre', () => {
    const onParentClose = vi.fn()
    render(
      <TerminalModal open onClose={onParentClose} title="Parent" zIndex={920}>
        <Harness />
      </TerminalModal>,
    )

    expect(screen.getByRole('dialog', { name: 'Parent' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /tabContexts\.appearance/i }))
    expect(screen.getByRole('dialog', { name: 'tabContexts.appearance' })).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'tabContexts.appearance' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Parent' })).toBeTruthy()
    expect(onParentClose).not.toHaveBeenCalled()
  })
})
