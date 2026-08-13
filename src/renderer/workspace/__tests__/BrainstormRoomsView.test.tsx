/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { BrainstormRoom } from '@shared/brainstormRoom'

vi.mock('@i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
  }),
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
  }) => (open ? (
    <div data-testid="list-modal">
      {children}
      <div>{footer}</div>
    </div>
  ) : null),
}))

vi.mock('../../components/ConfirmTerminalModal', () => ({
  ConfirmTerminalModal: () => null,
}))

vi.mock('../BrainstormEditRoomModal', () => ({
  BrainstormEditRoomModal: ({
    open,
    room,
  }: {
    open: boolean
    room: BrainstormRoom | null
  }) => (open && room ? (
    <div data-testid="edit-modal">{room.id}:{room.topic}</div>
  ) : null),
}))

import { BrainstormRoomsView } from '../BrainstormRoomsView'
import { PROJECT_DIR } from '@shared/projectDir'

function room(partial: Partial<BrainstormRoom>): BrainstormRoom {
  return {
    id: 'room-a',
    topic: 'Topic A',
    participantAgentIds: ['a', 'b'],
    maxRounds: 3,
    status: 'paused',
    round: 0,
    cursor: 0,
    messages: [],
    ...partial,
  }
}

/** La fila de una sala; el orden lo decide el agrupado, no el índice del array. */
function rowOf(topic: string): HTMLElement {
  const row = screen.getByText(topic).closest('li')
  if (!row) throw new Error(`sin fila para «${topic}»`)
  return row as HTMLElement
}

/** Abre el `⋯` de una fila; el menú va en portal, así que se busca en screen. */
function openMenu(topic: string): void {
  fireEvent.click(
    within(rowOf(topic)).getByRole('button', { name: 'tabs.brainstormsMoreActions' }),
  )
}

function renderModal(extra: Partial<React.ComponentProps<typeof BrainstormRoomsView>> = {}) {
  return render(
    <BrainstormRoomsView
      open
      cwd="/tmp/project"
      onClose={() => undefined}
      onCreate={() => undefined}
      onOpenRoom={() => undefined}
      {...extra}
    />,
  )
}

describe('BrainstormRoomsView', () => {
  const listBrainstorms = vi.fn()
  const exportBrainstormMarkdown = vi.fn()
  const materializeTabContext = vi.fn()

  beforeEach(() => {
    listBrainstorms.mockReset()
    exportBrainstormMarkdown.mockReset()
    materializeTabContext.mockReset()
    listBrainstorms.mockResolvedValue([
      room({ id: 'paused-1', topic: 'Paused room', status: 'paused' }),
      room({ id: 'running-1', topic: 'Running room', status: 'running' }),
      room({
        id: 'done-1',
        topic: 'Closed room',
        status: 'done',
        round: 3,
        messages: [{ agentId: 'a', agentName: 'A', round: 2, text: 'Decision: fixture primero' }],
      }),
    ])
    exportBrainstormMarkdown.mockResolvedValue({
      ok: true,
      path: `/tmp/project/${PROJECT_DIR}/brainstorms/paused-1.md`,
    })
    materializeTabContext.mockResolvedValue({ ok: true })
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      listBrainstorms,
      exportBrainstormMarkdown,
      materializeTabContext,
      deleteBrainstorm: vi.fn(),
      pruneBrainstorms: vi.fn(),
      openFolder: vi.fn(),
      saveBrainstorm: vi.fn(),
    }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('groups the running room first and offers the action its status implies', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Paused room')).toBeTruthy()
    })

    const topics = screen.getAllByText(/room$/).map(node => node.textContent)
    expect(topics).toEqual(['Running room', 'Paused room', 'Closed room'])
    expect(
      within(rowOf('Running room')).getByRole('button', { name: 'tabs.brainstormsLive' }),
    ).toBeTruthy()
    expect(
      within(rowOf('Paused room')).getByRole('button', { name: 'tabs.brainstormsResume' }),
    ).toBeTruthy()
    // Una sala cerrada no lleva botón «Abrir»: la fila entera es ese gesto, y su
    // etiqueta accesible lo dice.
    expect(
      within(rowOf('Closed room'))
        .getByRole('button', { name: 'tabs.brainstormsOpen: Closed room' }),
    ).toBeTruthy()
  })

  /*
   * Regresión: la biblioteca y la sala son dos vistas del mismo estado. Cuando
   * la fila cerraba además de abrir, `onClose` devolvía la vista a «nada
   * abierto» justo después de pedir la sala, y pulsar Abrir no hacía nada.
   */
  it('abrir una sala solo abre: no cierra la vista y la cancela', async () => {
    const onOpenRoom = vi.fn()
    const onClose = vi.fn()
    renderModal({ onOpenRoom, onClose })
    await waitFor(() => {
      expect(screen.getByText('Closed room')).toBeTruthy()
    })

    fireEvent.click(
      within(rowOf('Closed room'))
        .getByRole('button', { name: 'tabs.brainstormsOpen: Closed room' }),
    )
    expect(onOpenRoom).toHaveBeenCalledTimes(1)
    expect(onOpenRoom.mock.calls[0][0]).toMatchObject({ id: 'done-1' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('surfaces «to context» and export only on a closed room', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Closed room')).toBeTruthy()
    })

    expect(
      within(rowOf('Closed room')).getByRole('button', { name: 'tabs.brainstormsToContext' }),
    ).toBeTruthy()
    expect(
      within(rowOf('Paused room')).queryByRole('button', { name: 'tabs.brainstormsToContext' }),
    ).toBeNull()
    expect(
      within(rowOf('Paused room')).queryByRole('button', { name: 'tabs.brainstormsExportMd' }),
    ).toBeNull()
  })

  it('writes the room context with its closing and asks for a refresh', async () => {
    const onContextSaved = vi.fn()
    renderModal({ onContextSaved })
    await waitFor(() => {
      expect(screen.getByText('Closed room')).toBeTruthy()
    })

    fireEvent.click(
      within(rowOf('Closed room')).getByRole('button', { name: 'tabs.brainstormsToContext' }),
    )

    await waitFor(() => {
      expect(materializeTabContext).toHaveBeenCalledTimes(1)
    })
    const request = materializeTabContext.mock.calls[0][0]
    expect(request.context.id).toBe('iaterminal:notes:brainstorm-done-1')
    expect(request.content).toContain('fixture primero')
    await waitFor(() => {
      expect(onContextSaved).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps edit out of the menu while the room runs', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Running room')).toBeTruthy()
    })

    openMenu('Running room')
    expect(screen.queryByRole('menuitem', { name: 'tabs.brainstormsEdit' })).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })

    openMenu('Paused room')
    fireEvent.click(screen.getByRole('menuitem', { name: 'tabs.brainstormsEdit' }))
    expect(screen.getByTestId('edit-modal').textContent).toBe('paused-1:Paused room')
  })

  it('exports from the menu with cwd and room id', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Paused room')).toBeTruthy()
    })

    openMenu('Paused room')
    fireEvent.click(screen.getByRole('menuitem', { name: 'tabs.brainstormsExportMd' }))

    await waitFor(() => {
      expect(exportBrainstormMarkdown).toHaveBeenCalledWith('/tmp/project', 'paused-1')
    })
  })
})
