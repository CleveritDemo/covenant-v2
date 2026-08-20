/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PlaneChatComposerShell } from '../PlaneChatComposerShell'

afterEach(cleanup)

function renderShell(): void {
  render(
    <PlaneChatComposerShell
      value=""
      onChange={() => {}}
      placeholder="Escribe"
      inputLabel="Mensaje"
      sendLabel="Enviar"
      sendMode="send"
      onSendClick={() => {}}
      leading={<button type="button">Sketch</button>}
      fieldHeader={<div className="plane-chat-composer__agents-wrap">Riel</div>}
    />,
  )
}

describe('ancla composer-input del coach mark', () => {
  it('va en la fila entera, no en el shell del input', () => {
    renderShell()

    const anchor = document.querySelector('[data-onboarding="composer-input"]')
    expect(anchor).toBe(document.querySelector('.plane-chat-composer__row'))
    expect(
      document.querySelector('.plane-chat-composer__input-shell')
        ?.getAttribute('data-onboarding'),
    ).toBeNull()
  })

  it('el hueco del velo abraza riel, sketch y el botón de mic', () => {
    renderShell()

    const anchor = document.querySelector('[data-onboarding="composer-input"]') as HTMLElement
    expect(anchor.querySelector('.plane-chat-composer__agents-wrap')).not.toBeNull()
    expect(anchor.querySelector('textarea')).not.toBeNull()
    // El botón de envío/mic es el último hijo de la fila.
    expect(anchor.querySelectorAll('button').length).toBeGreaterThanOrEqual(2)
  })
})
