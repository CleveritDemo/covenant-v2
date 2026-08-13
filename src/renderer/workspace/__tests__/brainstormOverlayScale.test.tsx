/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { PLANE_MINI_WINDOW_HEIGHT } from '@shared/paneWindows'
import { brainstormSeatCellHeight } from '@shared/brainstormSeatCell'

vi.mock('@i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

import { BrainstormStartModal } from '../BrainstormStartModal'
import { BrainstormOverlay } from '../BrainstormOverlay'

function agent(id: string, role: string): ProjectAgentDefinition {
  return { id, name: id, role, provider: 'claude', permissionMode: 'plan' }
}

const startBrainstorm = vi.fn()

beforeEach(() => {
  cleanup()
  startBrainstorm.mockReset()
  ;(window as unknown as { api: Record<string, unknown> }).api = {
    startBrainstorm,
    discoverTabContexts: () => Promise.resolve({ ok: true, contexts: [] }),
  }
})

describe('BrainstormOverlay — escala como las minis del plano', () => {
  function mount(seatCount: number): void {
    render(
      <BrainstormOverlay
        ariaLabel="sala"
        closeLabel="cerrar"
        seatCount={seatCount}
        onClose={() => {}}
      >
        <p>acta</p>
      </BrainstormOverlay>,
    )
  }

  /** jsdom da clientHeight 0, así que la celda cae al alto base del plano. */
  it('publica el alto de celda como variable, para que la tarjeta lo herede', () => {
    mount(4)
    const overlay = document.querySelector('.brainstorm-overlay') as HTMLElement
    expect(overlay.style.getPropertyValue('--brainstorm-seat-cell')).toBe(
      `${brainstormSeatCellHeight(0, 4)}px`,
    )
  })

  it('con la celda en el mínimo la tarjeta pasa a su nivel más recortado', () => {
    mount(12)
    const overlay = document.querySelector('.brainstorm-overlay') as HTMLElement
    expect(brainstormSeatCellHeight(0, 12)).toBe(PLANE_MINI_WINDOW_HEIGHT)
    expect(overlay.getAttribute('data-seat-tier')).toBe('compact')
  })

  it('Escape cierra, salvo que haya un modal portaled encima', () => {
    const onClose = vi.fn()
    render(
      <BrainstormOverlay ariaLabel="sala" closeLabel="cerrar" onClose={onClose}>
        <p>acta</p>
      </BrainstormOverlay>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    const modal = document.createElement('div')
    modal.className = 'terminal-modal-root'
    document.body.appendChild(modal)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    modal.remove()
  })
})

describe('orden de habla — arrastrar cambia el turno', () => {
  const agents = [agent('rodrigo', 'Dev'), agent('ana', 'QA'), agent('nico', 'Dev')]

  function open(): void {
    render(
      <BrainstormStartModal
        open
        cwd="/repo"
        agents={agents}
        onClose={() => {}}
        onStarted={() => {}}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('tabs.brainstormTopicPlaceholder'), {
      target: { value: '¿Schema o RLS?' },
    })
    // El orden de habla es el orden en que se sientan.
    const right = document.querySelector('.brainstorm-overlay__col--right') as HTMLElement
    const cards = [...right.querySelectorAll('.brainstorm-seat--invite')] as HTMLElement[]
    ;['rodrigo', 'ana', 'nico'].forEach(name => {
      const card = cards.find(node => node.textContent?.includes(name))
      fireEvent.click(card as HTMLElement)
    })
  }

  function order(): string[] {
    return Array.from(document.querySelectorAll('.brainstorm-start__order-item'))
      .map(node => node.textContent?.replace(/^\d+/, '') ?? '')
  }

  it('soltar una tarjeta sobre otra reordena, y ese es el orden con el que arranca', () => {
    open()
    expect(order()).toEqual(['rodrigo', 'ana', 'nico'])

    const items = document.querySelectorAll('.brainstorm-start__order-item')
    fireEvent.dragStart(items[2])
    fireEvent.dragOver(items[0])
    fireEvent.drop(items[0])

    expect(order()).toEqual(['nico', 'rodrigo', 'ana'])
    fireEvent.click(screen.getByText('tabs.brainstormStart'))
    expect(startBrainstorm.mock.calls[0][0]).toMatchObject({
      participantAgentIds: ['nico', 'rodrigo', 'ana'],
    })
  })

  it('soltar sobre sí mismo no cambia nada', () => {
    open()
    const items = document.querySelectorAll('.brainstorm-start__order-item')
    fireEvent.dragStart(items[1])
    fireEvent.drop(items[1])
    expect(order()).toEqual(['rodrigo', 'ana', 'nico'])
  })
})
