/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

vi.mock('../../components/TerminalModal', () => ({
  TerminalModal: ({
    open,
    children,
    footer,
  }: {
    open: boolean
    children: React.ReactNode
    footer?: React.ReactNode
  }) => (
    open ? (
      <div>
        {children}
        {footer}
      </div>
    ) : null
  ),
}))

vi.mock('../../components/ui/Icon', () => ({
  Icon: () => <span data-testid="icon" />,
}))

import { QueuedTurnEditModal } from '../QueuedTurnEditModal'

afterEach(cleanup)

describe('QueuedTurnEditModal', () => {
  it('renderiza una miniatura por imagen adjunta', () => {
    render(
      <QueuedTurnEditModal
        open
        initialText="hello"
        images={[
          { id: 'a', previewUrl: 'blob:a', name: 'first.png' },
          { id: 'b', previewUrl: 'blob:b', name: 'second.png' },
        ]}
        onSave={() => {}}
        onClose={() => {}}
      />,
    )

    const imgs = screen.getAllByRole('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]!.getAttribute('src')).toBe('blob:a')
    expect(imgs[0]!.getAttribute('alt')).toBe('first.png')
    expect(imgs[1]!.getAttribute('src')).toBe('blob:b')
    expect(imgs[1]!.getAttribute('alt')).toBe('second.png')
  })

  it('no renderiza imágenes cuando la cola no trae adjuntos', () => {
    render(
      <QueuedTurnEditModal
        open
        initialText="hello"
        onSave={() => {}}
        onClose={() => {}}
      />,
    )

    expect(screen.queryByRole('img')).toBeNull()
  })

  it('deja Guardar habilitado si queda al menos una imagen aunque se vacíe el texto', () => {
    render(
      <QueuedTurnEditModal
        open
        initialText="hello"
        images={[{ id: 'a', previewUrl: 'blob:a', name: 'first.png' }]}
        onSave={() => {}}
        onClose={() => {}}
      />,
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '' } })

    const save = screen.getByRole('button', { name: 'agentPane.queueEditSave' }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
  })
})
