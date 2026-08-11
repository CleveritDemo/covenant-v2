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

import { BrainstormListModal } from '../BrainstormListModal'
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

describe('BrainstormListModal edit/export wiring', () => {
  const listBrainstorms = vi.fn()
  const exportBrainstormMarkdown = vi.fn()

  beforeEach(() => {
    listBrainstorms.mockReset()
    exportBrainstormMarkdown.mockReset()
    listBrainstorms.mockResolvedValue([
      room({ id: 'paused-1', topic: 'Paused room', status: 'paused' }),
      room({ id: 'running-1', topic: 'Running room', status: 'running' }),
    ])
    exportBrainstormMarkdown.mockResolvedValue({
      ok: true,
      path: `/tmp/project/${PROJECT_DIR}/brainstorms/paused-1.md`,
    })
    ;(window as unknown as { api: Record<string, unknown> }).api = {
      listBrainstorms,
      exportBrainstormMarkdown,
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

  it('disables Edit when status is running and opens edit modal for paused room', async () => {
    render(
      <BrainstormListModal
        open
        cwd="/tmp/project"
        onClose={() => undefined}
        onCreate={() => undefined}
        onOpenRoom={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Paused room')).toBeTruthy()
    })

    const editRunning = within(rowOf('Running room'))
      .getByRole('button', { name: 'tabs.brainstormsEdit' }) as HTMLButtonElement
    expect(editRunning.disabled).toBe(true)

    const editPaused = within(rowOf('Paused room'))
      .getByRole('button', { name: 'tabs.brainstormsEdit' })
    fireEvent.click(editPaused)
    expect(screen.getByTestId('edit-modal').textContent).toBe('paused-1:Paused room')
  })

  it('calls exportBrainstormMarkdown with cwd and room id', async () => {
    render(
      <BrainstormListModal
        open
        cwd="/tmp/project"
        onClose={() => undefined}
        onCreate={() => undefined}
        onOpenRoom={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Paused room')).toBeTruthy()
    })

    fireEvent.click(
      within(rowOf('Paused room')).getByRole('button', { name: 'tabs.brainstormsExportMd' }),
    )

    await waitFor(() => {
      expect(exportBrainstormMarkdown).toHaveBeenCalledWith('/tmp/project', 'paused-1')
    })
  })

  it('groups the running room first and offers the action its status implies', async () => {
    render(
      <BrainstormListModal
        open
        cwd="/tmp/project"
        onClose={() => undefined}
        onCreate={() => undefined}
        onOpenRoom={() => undefined}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Paused room')).toBeTruthy()
    })

    const topics = screen.getAllByText(/room$/).map(node => node.textContent)
    expect(topics).toEqual(['Running room', 'Paused room'])
    expect(
      within(rowOf('Running room')).getByRole('button', { name: 'tabs.brainstormsLive' }),
    ).toBeTruthy()
    expect(
      within(rowOf('Paused room')).getByRole('button', { name: 'tabs.brainstormsResume' }),
    ).toBeTruthy()
  })
})
