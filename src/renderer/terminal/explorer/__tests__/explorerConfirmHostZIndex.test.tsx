/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { ExplorerConfirmHost } from '../ExplorerConfirmHost'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

afterEach(cleanup)

function OpenHost({ zIndex }: { zIndex?: number }): React.ReactElement {
  return (
    <ExplorerConfirmHost zIndex={zIndex}>
      {requestConfirm => (
        <button
          type="button"
          onClick={() => {
            void requestConfirm({
              type: 'delete',
              message: 'delete me',
              onConfirm: () => {},
            })
          }}
        >
          ask
        </button>
      )}
    </ExplorerConfirmHost>
  )
}

function modalZ(): number {
  const root = document.querySelector('.terminal-modal-root') as HTMLElement | null
  expect(root).toBeTruthy()
  return Number(root!.style.getPropertyValue('--modal-z').trim())
}

describe('ExplorerConfirmHost z-index', () => {
  it('sin prop, el confirm supera la z del overlay del explorador', () => {
    render(<OpenHost />)
    fireEvent.click(screen.getByRole('button', { name: 'ask' }))
    expect(modalZ()).toBeGreaterThan(APP_OVERLAY_MODAL_Z)
  })

  it('con zIndex={900} usa 900', () => {
    render(<OpenHost zIndex={900} />)
    fireEvent.click(screen.getByRole('button', { name: 'ask' }))
    expect(modalZ()).toBe(900)
  })
})
