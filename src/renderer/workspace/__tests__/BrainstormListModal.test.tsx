/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

    const editButtons = screen.getAllByRole('button', { name: 'tabs.brainstormsEdit' })
    expect(editButtons).toHaveLength(2)
    expect((editButtons[1] as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(editButtons[0])
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

    const exportButtons = screen.getAllByRole('button', { name: 'tabs.brainstormsExportMd' })
    fireEvent.click(exportButtons[0])

    await waitFor(() => {
      expect(exportBrainstormMarkdown).toHaveBeenCalledWith('/tmp/project', 'paused-1')
    })
  })
})
